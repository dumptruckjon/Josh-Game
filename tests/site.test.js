// Structure + content tests for Josh's Games. No browser — runs with
// `node --test`. Guards wiring (files, cache-bust tokens, SW precache), content
// shape, mobile/kid guardrails, and JS syntax across every script.

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const root = path.join(__dirname, "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const content = require("../scripts/content.js");

const SCRIPTS = [
  "scripts/content.js", "scripts/logic.js", "scripts/effects.js", "scripts/audio.js", "scripts/art.js",
  "scripts/framework.js", "scripts/games-toys.js", "scripts/games-math.js",
  "scripts/games-logic.js", "scripts/games-literacy.js", "scripts/games-science.js",
  "scripts/games-calm.js", "scripts/games-fun.js", "scripts/games-find.js", "scripts/main.js",
];

test("core files exist", () => {
  for (const f of ["index.html", "styles/main.css", "sw.js", "manifest.webmanifest", ...SCRIPTS]) {
    assert.ok(fs.existsSync(path.join(root, f)), `missing ${f}`);
  }
});

test("index.html loads every script + css, all cache-busted", () => {
  const html = read("index.html");
  assert.match(html, /styles\/main\.css\?v=/, "css not cache-busted");
  assert.match(html, /manifest\.webmanifest\?v=/, "manifest not cache-busted");
  for (const s of SCRIPTS) {
    const rx = new RegExp(s.replace(/[.\/]/g, "\\$&") + "\\?v=");
    assert.match(html, rx, `${s} not referenced/cache-busted in index.html`);
  }
});

test("service worker precaches every script + css + index", () => {
  const sw = read("sw.js");
  for (const s of [...SCRIPTS, "styles/main.css", "index.html"]) {
    assert.ok(sw.includes(s.replace(/^scripts\//, "scripts/")), `SW missing ${s}`);
  }
  assert.match(sw, /addEventListener\(\s*["']fetch["']/, "SW needs a fetch handler");
  assert.match(sw, /addEventListener\(\s*["']install["']/, "SW needs an install handler");
});

test("games self-register into the framework registry", () => {
  for (const f of ["scripts/games-toys.js", "scripts/games-math.js", "scripts/games-logic.js", "scripts/games-literacy.js", "scripts/games-science.js", "scripts/games-calm.js", "scripts/games-fun.js", "scripts/games-find.js"]) {
    assert.match(read(f), /F\.register\(|JoshFramework\.register\(/, `${f} should register a game`);
  }
  assert.match(read("scripts/main.js"), /serviceWorker\.register/, "main.js should register the SW");
  assert.match(read("scripts/framework.js"), /data-correct|dataset\.won|correct/, "framework should implement the test contract");
});

// ---------- Content shape ----------
test("people: friends (Josh + Raegar/River/Viraj) and heroes are present", () => {
  const names = (content.FRIENDS || []).map((f) => f.name);
  for (const who of ["Raegar", "River", "Viraj"]) assert.ok(names.includes(who), `missing friend ${who}`);
  for (const f of content.FRIENDS) assert.ok(f.name && f.emoji, "friend needs name + emoji");
  assert.ok(Array.isArray(content.HEROES) && content.HEROES.length >= 3, "need >= 3 heroes");
});

test("praise/cheer/confetti content is well-formed", () => {
  assert.ok(content.CHEERS.length >= 4 && content.CHEERS.every((s) => typeof s === "string" && s));
  assert.ok(content.PRAISE_SPOKEN.length >= 4 && content.PRAISE_SPOKEN.every((s) => typeof s === "string" && s));
  assert.ok(content.CONFETTI_COLORS.length >= 4);
  content.CONFETTI_COLORS.forEach((c) => assert.match(c, /^#[0-9a-fA-F]{3,8}$/, `bad color ${c}`));
});

test("game data is well-formed (animals, eaters, snacks, odd groups, patterns)", () => {
  // animals: unique emoji so a fresh tap always looks different
  assert.ok(content.ANIMALS.length >= 8);
  assert.equal(new Set(content.ANIMALS.map((a) => a.emoji)).size, content.ANIMALS.length, "animal emojis unique");
  content.ANIMALS.forEach((a) => assert.ok(a.emoji && a.name));

  assert.ok(content.EATERS.length >= 3 && content.EATERS.every((e) => e.emoji && e.name));
  assert.ok(content.SNACKS.length >= 4 && content.SNACKS.every((s) => typeof s === "string" && s));

  // odd-one-out groups: >= 2 groups, >= 4 items each, and disjoint across groups
  assert.ok(Array.isArray(content.ODD_GROUPS) && content.ODD_GROUPS.length >= 3);
  const seen = new Map();
  for (const g of content.ODD_GROUPS) {
    assert.ok(g.name && Array.isArray(g.items) && g.items.length >= 4, `bad group ${g.name}`);
    for (const it of g.items) {
      assert.ok(!seen.has(it) || seen.get(it) === g.name, `emoji ${it} appears in two groups`);
      seen.set(it, g.name);
    }
  }

  // pattern sets: each is a 2-token pair of distinct tokens
  assert.ok(Array.isArray(content.PATTERN_SETS) && content.PATTERN_SETS.length >= 4);
  content.PATTERN_SETS.forEach((p) => {
    assert.equal(p.length, 2, "pattern set must be a pair");
    assert.notEqual(p[0], p[1], "pair tokens must differ");
  });
});

// ---------- Mobile / kid guardrails ----------
test("background is static; nothing animates the full-page background", () => {
  const css = read("styles/main.css");
  assert.match(css, /linear-gradient\(/, "should have a gradient background");
  // No @keyframes may animate a background property (that's the iOS-repaint bug).
  const kfBlocks = css.match(/@keyframes[^{]+\{(?:[^{}]|\{[^}]*\})*\}/g) || [];
  for (const b of kfBlocks) {
    assert.ok(!/background/i.test(b), "a @keyframes animates 'background' — animated backgrounds are banned");
  }
  // The body itself must not be animated.
  assert.ok(!/\bbody\s*\{[^}]*animation\s*:/.test(css.replace(/\s+/g, " ")), "body must not be animated");
});

test("mobile / iOS Safari optimizations are in place", () => {
  const html = read("index.html");
  assert.match(html, /name="viewport"[^>]*viewport-fit=cover/, "viewport-fit=cover missing");
  assert.match(html, /apple-mobile-web-app-capable/, "iOS web-app meta missing");

  const css = read("styles/main.css");
  const cssValues = css.replace(/\/\*[\s\S]*?\*\//g, ""); // ignore "100vh" mentioned in comments
  assert.match(cssValues, /100dvh/, "use dvh, not bare 100vh");
  assert.ok(!cssValues.includes("100vh"), "use 100dvh, never bare 100vh");
  assert.match(css, /env\(safe-area-inset/, "respect the notch");
  assert.match(css, /-webkit-backdrop-filter/, "Safari needs -webkit-backdrop-filter");
  assert.match(css, /touch-action:\s*manipulation/, "prevent double-tap zoom");
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
  assert.match(html, /rel="manifest"/);
  assert.match(html, /rel="apple-touch-icon"/);
  const manifest = JSON.parse(read("manifest.webmanifest"));
  assert.equal(manifest.display, "standalone");
  assert.ok(manifest.start_url);
  const sizes = (manifest.icons || []).map((i) => i.sizes);
  assert.ok(sizes.includes("192x192") && sizes.includes("512x512"));
  for (const icon of manifest.icons) assert.ok(fs.existsSync(path.join(root, icon.src)), `missing icon ${icon.src}`);
});

// ---------- Self-healing guardrails (each hard-won fix, enforced forever) ----------
// RULE 7: when a bug reveals a pattern, wire a guardrail so it can't come back in
// ANY existing game or ANY future one. These are those guardrails.

test("guardrail: games make sound only through the shared iOS-safe JoshAudio.tone", () => {
  // The 'silent on iPad' bug came from a game constructing its own AudioContext
  // and scheduling a note before the async resume() resolved. The fix lives in
  // ONE place (audio.js JoshAudio.tone); no game may construct audio itself.
  for (const f of SCRIPTS) {
    if (!/scripts\/games-.*\.js$/.test(f)) continue;
    const src = read(f);
    assert.ok(!/new\s+[\w.]*AudioContext|webkitAudioContext/.test(src),
      `${f} references an AudioContext constructor — route sound through JoshAudio.tone()/unlock() (iOS-safe) instead`);
  }
});

test("guardrail: JoshAudio.tone resumes the context BEFORE scheduling (iOS-safe)", () => {
  // Lock in the shape of the fix so a future refactor can't reintroduce
  // schedule-then-resume (which is silent on iOS).
  const a = read("scripts/audio.js");
  assert.ok(/resume\(\)\s*\.then\(/.test(a), "tone() must resume().then(play) — resume BEFORE scheduling the note");
  assert.ok(/currentTime\s*\+\s*0?\.0/.test(a), "the note must be scheduled slightly in the FUTURE (never at a past time)");
  assert.ok(/JoshAudio\s*=\s*\{[^}]*\btone\b/.test(a.replace(/\s+/g, " ")), "JoshAudio must export tone()");
});

test("guardrail: the every-game harness drives the contract with a DOM click", () => {
  // A coordinate (force) click misses under CPU load when a field reflows mid-tap
  // (big-red-one got stuck). The contract test must dispatch a DOM el.click().
  const e2e = read("tests/e2e.test.js");
  assert.ok(/\.evaluate\(\s*\(el\)\s*=>\s*el\.click\(\)\s*\)/.test(e2e),
    "the every-game loop must drive taps via a DOM el.click() (load-immune), not a coordinate click");
});

test("guardrail: no game splices a hard-coded 'a'/'an' before a dynamic word", () => {
  // 'Make a " + name' rendered "Make a Island". The fix is L.article(word), which
  // picks a/an by sound. Forbid the antipattern everywhere so it can't come back:
  // a string literal ending in "a "/"an " immediately concatenated with a value.
  const bad = /["'](?:a|an) ["']\s*\+/i;
  for (const f of SCRIPTS) {
    if (!/scripts\/games-.*\.js$/.test(f)) continue;
    const src = read(f);
    assert.ok(!bad.test(src),
      `${f} concatenates a fixed article before a word (reads "a Island") — use JoshLogic.article(word) instead`);
  }
});

// ---------- Syntax ----------
test("all scripts are valid JavaScript", () => {
  for (const f of SCRIPTS) execFileSync(process.execPath, ["--check", path.join(root, f)]);
});
