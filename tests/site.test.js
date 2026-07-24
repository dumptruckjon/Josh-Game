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
  "scripts/stickers.js", "scripts/buddy.js", "scripts/framework.js", "scripts/games-toys.js", "scripts/games-math.js",
  "scripts/games-logic.js", "scripts/games-literacy.js", "scripts/games-science.js",
  "scripts/games-calm.js", "scripts/games-fun.js", "scripts/games-find.js",
  "scripts/hl-content.js", "scripts/games-hl-a.js", "scripts/games-hl-b.js", "scripts/hl-main.js",
  "scripts/td-data.js", "scripts/td-logic.js", "scripts/td-render.js", "scripts/td-ui.js", "scripts/td-main.js",
  "scripts/main.js",
];

test("core files exist", () => {
  for (const f of ["index.html", "styles/main.css", "styles/td.css", "sw.js", "manifest.webmanifest", ...SCRIPTS]) {
    assert.ok(fs.existsSync(path.join(root, f)), `missing ${f}`);
  }
});

test("index.html loads every script + css, all cache-busted", () => {
  const html = read("index.html");
  assert.match(html, /styles\/main\.css\?v=/, "css not cache-busted");
  assert.match(html, /styles\/td\.css\?v=/, "td css not cache-busted");
  assert.match(html, /manifest\.webmanifest\?v=/, "manifest not cache-busted");
  for (const s of SCRIPTS) {
    const rx = new RegExp(s.replace(/[.\/]/g, "\\$&") + "\\?v=");
    assert.match(html, rx, `${s} not referenced/cache-busted in index.html`);
  }
});

test("service worker precaches every script + css + index", () => {
  const sw = read("sw.js");
  for (const s of [...SCRIPTS, "styles/main.css", "styles/td.css", "index.html"]) {
    assert.ok(sw.includes(s.replace(/^scripts\//, "scripts/")), `SW missing ${s}`);
  }
  assert.match(sw, /addEventListener\(\s*["']fetch["']/, "SW needs a fetch handler");
  assert.match(sw, /addEventListener\(\s*["']install["']/, "SW needs an install handler");
});

test("guardrail: Fort Josh (TD) is wired in AND fully isolated from the kid worlds", () => {
  // Jon's tower-defense world (PLAN_TOWER_DEFENSE.md). The isolation
  // invariants are load-bearing: the fort must never leak into Josh's or 华丽's
  // spaces — no registry entry (so the every-game harness, launcher, Surprise,
  // Sticker Book and kid audits never see it), its own storage namespace, and
  // audio only through the ONE iOS-safe JoshAudio path.
  const tdFiles = SCRIPTS.filter((s) => /scripts\/td-/.test(s));
  assert.equal(tdFiles.length, 5, "the five td-*.js files are in the SCRIPTS wiring list");
  for (const f of tdFiles) {
    const src = read(f);
    assert.ok(!/JoshFramework\s*\.\s*register|JoshGames\s*\.\s*push/.test(src),
      f + " must NEVER register into the kid game registry");
    assert.ok(!/new\s+(webkit)?AudioContext/.test(src),
      f + " must route audio through JoshAudio.tone (the ONE iOS-safe path)");
    assert.ok(!/josh-won-/.test(src), f + " must never touch josh-won-* flags");
    const stores = src.match(/localStorage\.(setItem|getItem|removeItem)\(\s*["'][^"']+/g) || [];
    for (const call of stores) {
      assert.ok(/["']jon-td-/.test(call), f + " localStorage keys must be jon-td-* namespaced, got: " + call);
    }
  }
  // The old "Jon" name gate is GONE by request (2026-07): the fort opens
  // directly from the front door's 🏰 tile. Lock the removal so the gate (and
  // its dead session flag) can't quietly return.
  const ui = read("scripts/td-ui.js");
  assert.ok(!/td-gate/.test(ui), "the fort name gate is removed — the 🏰 start tile opens the fort directly");
  assert.ok(!/injectDoor/.test(ui), "the old top-bar 🏰 door is removed (the front door replaced it)");
  const tdmSrc = read("scripts/td-main.js");
  assert.ok(!/td-ok/.test(tdmSrc), "no td-ok session flag remains anywhere in the fort glue");
  const logic = read("scripts/td-logic.js");
  assert.match(logic, /module\.exports/, "td-logic dual-exports for node sims");
  assert.ok(!/Math\.random/.test(logic), "the ENGINE must be seeded-RNG only (determinism law)");
  assert.match(read("scripts/td-data.js"), /module\.exports/, "td-data dual-exports for node truth tests");
  assert.match(read("scripts/main.js"), /td-/, "main.js routes td-* hashes through JonTD.route (try/catch-isolated)");
});

test("guardrail: deep-audit fixes stay wired (hidden-immune AoE, per-toast timer, leave-play cleanup)", () => {
  // RULE 7: each fix from the deep adversarial audit gets a source-level lock so
  // it can't silently regress (these complement the behavioral node/browser tests).
  const logic = read("scripts/td-logic.js");
  // (0/3) hidden (phased ghost / tunnelling mole) is untargetable by EVERY damage
  // path — the mortar splash loop and the chain-jump both skip isHidden(e).
  assert.match(logic, /flier \|\| isHidden\(e\)\) continue;/, "mortar splash skips hidden enemies");
  assert.match(logic, /isHidden\(e\) \|\| hitIds\.indexOf/, "chain-lightning jump skips hidden enemies");
  assert.match(logic, /isHidden:\s*\(e\)\s*=>\s*isHidden\(e\)/, "the engine exposes isHidden for guardrails");

  const ui = read("scripts/td-ui.js");
  // (9) each achievement toast owns its OWN removal timer — a shared handle used
  // to orphan every toast but the last (a DOM leak on multi-badge wins).
  assert.ok(!/UI\._toastT/.test(ui), "toast must NOT use a single shared removal timer (orphans earlier nodes)");
  assert.match(ui, /setTimeout\(\s*\(\)\s*=>\s*\{?\s*el\.remove\(\)/, "each toast schedules its own removal");

  const main = read("scripts/td-main.js");
  // (1) a stars-less/corrupt save is coerced at boot so the first win can't crash.
  assert.match(main, /typeof save\.stars !== "object"\)\s*save\.stars = \{\}/, "boot coerces a missing/corrupt stars field");
  // (2/4/5) the resume checkpoint carries the achievement context.
  assert.match(main, /leaked:\s*!!cur\.leaked/, "writeMidRun snapshots the leak flag");
  assert.match(main, /cur\.lines\[t\.lineId\] = true/, "resumeMidRun repopulates tower lines (Pea Purist)");
  // (6/8) leaving a live battle records the endless milestone AND clears transient
  //       field state (armed rally / selection), wired into BOTH leave chokepoints.
  assert.match(main, /function leavingPlay\(\)/, "a single leave-play helper exists");
  assert.match(main, /cur\.rallyArmId = 0;/, "leavingPlay clears a half-armed camp rally");
  assert.equal((main.match(/leavingPlay\(\);/g) || []).length >= 2, true, "leavingPlay is called from both the fort-home route and onLeave");
});

test("guardrail: TD-7 multi-path lanes + the L10 track-switch lever stay wired", () => {
  // The deferred subsystem, now shipped: an enemy travels its own lane, the lever
  // is a real mechanic (not the old notYet stub), and the renderer/UI honor lanes.
  const logic = read("scripts/td-logic.js");
  assert.ok(!/pullLever:\s*notYet/.test(logic), "the lever is IMPLEMENTED, not the old notYet stub");
  assert.match(logic, /function pullLever\(\)/, "the engine implements pullLever()");
  assert.match(logic, /posOn:\s*\(pathIdx/, "the engine exposes posOn(pathIdx,dist) so each enemy renders on its own lane");
  assert.match(logic, /const epos = \(e\) => posAt\(epath\(e\)/, "enemies move/target on their OWN lane (epath/epos), not always lane 0");
  const render = read("scripts/td-render.js");
  assert.match(render, /engine\.posOn\(e\.pathIdx/, "the renderer positions every enemy on its own lane");
  assert.match(render, /engine\.levelDef\.lever/, "the renderer draws the lever control");
  const main = read("scripts/td-main.js");
  assert.match(main, /engine\.pullLever\(\)/, "a field tap on the lever throws it");
});

test("guardrail: the SW offline fallback is version-query tolerant (ignoreSearch)", () => {
  // Self-healing (RULE 7). The page loads every asset with a ?v=<sha> cache-bust
  // query, but the SW precaches the UNVERSIONED paths (CORE lists
  // "./scripts/main.js"). A query-sensitive caches.match therefore MISSES offline
  // and the script requests fall through to the index.html fallback — the browser
  // then parses HTML as JS ("Unexpected token '<'") and the app boots as a dead
  // shell. The offline fallback MUST retry with { ignoreSearch: true } so the
  // precache still satisfies a versioned request. offline.test.js proves the real
  // boot; this locks the mechanism so it can't silently regress in a refactor.
  const sw = read("sw.js");
  assert.match(sw, /ignoreSearch\s*:\s*true/, "SW offline fallback must retry cache with { ignoreSearch: true } so ?v= assets still resolve offline");
});

test("games self-register into the framework registry", () => {
  for (const f of ["scripts/games-toys.js", "scripts/games-math.js", "scripts/games-logic.js", "scripts/games-literacy.js", "scripts/games-science.js", "scripts/games-calm.js", "scripts/games-fun.js", "scripts/games-find.js", "scripts/games-hl-a.js", "scripts/games-hl-b.js"]) {
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
  const cssValues = css.replace(/\/\*[\s\S]*?\*\//g, ""); // ignore units mentioned in comments
  assert.match(cssValues, /100dvh/, "use dvh (with a vh fallback), not bare 100vh");
  // iOS-floor law (deep-audit): Safari 14.0 (Josh's iOS 14.2 iPad) has NO dvh —
  // the declaration is silently dropped. Every dvh use must therefore be paired
  // with a same-property PLAIN-vh fallback earlier in the SAME rule body.
  for (const file of ["styles/main.css", "styles/td.css"]) {
    const body = read(file).replace(/\/\*[\s\S]*?\*\//g, "");
    for (const rule of body.split("}")) {
      const decls = rule.split("{").pop() || "";
      const dvhDecls = decls.match(/[-a-z]+\s*:[^;]*dvh[^;]*/g) || [];
      for (const d of dvhDecls) {
        const prop = d.match(/^([-a-z]+)\s*:/)[1];
        const fallback = new RegExp(prop + "\\s*:[^;]*\\d(vh)\\b[^;]*;[\\s\\S]*" + prop + "\\s*:[^;]*dvh");
        assert.ok(fallback.test(decls),
          `${file}: "${d.trim()}" needs a same-property vh fallback declared before it in the same rule (Safari 14 drops dvh)`);
      }
    }
  }
  // Safari 14.0 also lacks the `inset:` shorthand (14.1) — longhands only.
  for (const file of ["styles/main.css", "styles/td.css"]) {
    const body = read(file).replace(/\/\*[\s\S]*?\*\//g, "");
    assert.ok(!/[^-a-z]inset\s*:/.test(body), `${file}: use top/right/bottom/left longhands, never the inset: shorthand (dropped on iOS 14.2)`);
  }
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

test("guardrail: game screens fill the viewport and centre the play (no dead bottom half)", () => {
  // A#1: the engagement fix — games were stranded in the top third. Lock the
  // mechanism so a refactor can't silently bring back the empty bottom half.
  const css = read("styles/main.css").replace(/\s+/g, " ");
  assert.ok(/body\.in-game \{ display: flex/.test(css),
    "body.in-game must become a flex column so the open game fills the viewport");
  assert.ok(/justify-content: safe center/.test(css),
    "the stage must centre its content with `safe center` (fills the dead space, never clips tall games)");
  assert.ok(/\.screen\[hidden\] \{ display: none !important/.test(css),
    "hidden screens must stay display:none !important so the game-screen flex rule can't reveal them");
});

test("guardrail: the framework exposes the reactive mascot and wires its reactions", () => {
  // A#2: any game can opt into a buddy that reacts to taps. Keep the hook wired.
  const fw = read("scripts/framework.js");
  assert.ok(/mascot\s*\(/.test(fw), "framework must expose api.mascot()");
  assert.ok(/reactMascot\(["']cheer["']\)/.test(fw), "win/roundWin must cheer the mascot");
  assert.ok(/reactMascot\(["']wiggle["']\)/.test(fw), "tryAgain must wiggle the mascot");
});

test("guardrail: win/round/try-again play mute-gated audio cues (silent-play feedback)", () => {
  // Wins were visually rich but SILENT. The confirming tone / win jingle / gentle
  // bump are centralized in audio.js (mute-gated so 'sound off' truly silences
  // them) and fired from the framework, so every game inherits sound feedback.
  const a = read("scripts/audio.js");
  assert.ok(/winCue/.test(a) && /goodCue/.test(a) && /bumpCue/.test(a), "audio.js must expose win/good/bump cues");
  assert.ok(/if \(muted\) return/.test(a), "celebration cues must be mute-gated (sound is OFF by default)");
  const fw = read("scripts/framework.js");
  assert.ok(/winCue/.test(fw), "framework win() must fire the win jingle");
  assert.ok(/goodCue/.test(fw), "framework roundWin() must fire a confirming cue");
  assert.ok(/bumpCue/.test(fw), "framework tryAgain() must fire a gentle (non-punishing) bump cue");
});

test("guardrail: the Sticker Book exists and josh-won progress has ONE owner", () => {
  // The reward layer + single-owner progress. josh-won-* state must live in
  // JoshProgress (stickers.js) so the ⭐ badge, the Sticker Book, the framework
  // win(), and the grown-ups reset can never drift apart.
  const st = read("scripts/stickers.js");
  assert.ok(/JoshProgress/.test(st) && /josh-won-/.test(st) && /removeItem/.test(st),
    "stickers.js (JoshProgress) must own reading/writing/clearing the josh-won-* flags");
  assert.ok(/JoshStickers/.test(st) && /artFor/.test(st),
    "stickers.js must expose JoshStickers.artFor for a deterministic sticker per game");
  const fw = read("scripts/framework.js");
  assert.ok(/JoshProgress/.test(fw) && /markWon/.test(fw),
    "framework win() must record the win via JoshProgress.markWon (single owner)");
  const m = read("scripts/main.js");
  assert.ok(/screen-stickers/.test(m) && /"stickers"/.test(m), "main.js must build + route the Sticker Book screen");
  assert.ok(/tile--stickers/.test(m) && /📖/.test(m), "the home screen needs a Sticker Book tile");
  assert.ok(/JoshProgress/.test(m), "main.js must read win-state through JoshProgress, not raw localStorage");
});

test("guardrail: the grown-ups reset gate exists and only 'reset' clears stars", () => {
  const m = read("scripts/main.js");
  assert.ok(/reset-stars/.test(m), "needs a grown-ups reset button");
  assert.ok(/dataset\.adult|data-adult/.test(m), "the gate must be marked adult-only (exempt from the kid ≥75px audit)");
  assert.ok(/josh-won-/.test(m) && /removeItem/.test(m), "clearStars() must remove the josh-won-* flags");
  assert.ok(/toLowerCase\(\)\s*===\s*["']reset["']/.test(m), "ONLY the word 'reset' (any case) may clear the stars");
});

test("guardrail: the framework tracks a clean-win streak for gentle difficulty ramping", () => {
  // Wave-3 adaptivity: a game can raise difficulty once Josh masters it and ease
  // back when he stumbles — invisibly (no number, no fail). Keep the engine wired.
  const fw = read("scripts/framework.js");
  assert.ok(/shouldRamp/.test(fw), "framework api must expose shouldRamp() for adaptive difficulty");
  assert.ok(/missedSinceWin/.test(fw), "a miss (tryAgain) must break the clean streak");
  assert.ok(/firstTryStreak/.test(fw), "roundWin must grow the clean-first-try streak");
  assert.ok(/dataset\.streak/.test(fw), "the streak must be observable via screen.dataset.streak (for tests)");
  const gm = read("scripts/games-math.js");
  assert.ok(/shouldRamp/.test(gm), "at least one game (Number Muncher) must ramp difficulty via api.shouldRamp");
});

test("guardrail: the Buddy pipeline is wired and owns the josh-buddy token", () => {
  // Josh's ONE chosen buddy (josh-buddy) threads to the home companion AND every
  // win celebration. Keep the single owner + the framework/home wiring in place.
  const b = read("scripts/buddy.js");
  assert.ok(/JoshBuddy/.test(b) && /josh-buddy/.test(b), "buddy.js must expose JoshBuddy + own the josh-buddy token");
  assert.ok(/choose/.test(b) && /\bart\b/.test(b) && /mount/.test(b), "JoshBuddy must expose choose(), art(), mount()");
  const fw = read("scripts/framework.js");
  assert.ok(/JoshBuddy/.test(fw), "framework win() must pop the chosen buddy (with a hero fallback)");
  const m = read("scripts/main.js");
  assert.ok(/JoshBuddy\.mount/.test(m), "main.js must mount the buddy companion on the home screen");
});

test("guardrail: Look From Above's top-down map stays aligned with the isometric scene", () => {
  // The fix re-laid the footprint as a DIAMOND matching the scene. The map is
  // only correct if occupancy index i lands in the same screen quadrant in BOTH
  // the scene projection and the footprint — pin both so a reorder can't silently
  // bring back the 45° misalignment (which a green suite wouldn't otherwise catch,
  // since the e2e harness taps data-correct independent of visual layout).
  const g = read("scripts/games-logic.js");
  assert.ok(/cell\.c\s*-\s*cell\.r/.test(g), "the scene's x axis must be (c - r)");
  assert.ok(/cell\.c\s*\+\s*cell\.r/.test(g), "the scene's depth axis must be (c + r)");
  assert.ok(
    /be__cell--n["']\s*,\s*["']be__cell--e["']\s*,\s*["']be__cell--w["']\s*,\s*["']be__cell--s/.test(g),
    "footprint() must map occupancy index 0→N (back/top), 1→E (right), 2→W (left), 3→S (front/bottom)"
  );
});

// ---------- 华丽 (the hidden grandma world) guardrails ----------
test("the front door: three world tiles open Josh's / 华丽's / the fort DIRECTLY (no gates)", () => {
  // By request (2026-07) the name gates are gone: the app opens on a start page
  // whose three tiles navigate straight to each world. Lock both halves — the
  // start page exists AND no gate machinery remains to re-lock a world.
  const html = read("index.html");
  assert.match(html, /id="screen-start"/, "index.html carries the front-door screen");
  for (const tile of ["start-josh", "start-hl", "start-td"]) {
    assert.ok(html.includes('id="' + tile + '"'), "the front door has the " + tile + " tile");
  }
  assert.match(html, /id="home-door"/, "Josh's home carries the 🚪 back-to-front-door button");
  const mainjs = read("scripts/main.js");
  assert.match(mainjs, /wire\("start-josh", "#home"\)/, "the Josh tile opens his launcher");
  assert.match(mainjs, /wire\("start-hl", "#hl-home"\)/, "the 👵🏻 tile opens her world directly");
  assert.match(mainjs, /wire\("start-td", "#td-home"\)/, "the 🏰 tile opens the fort directly");
  const hm = read("scripts/hl-main.js");
  assert.ok(!/hl-ok/.test(hm) && !/sessionStorage/.test(hm), "no hl-ok session flag / gate remains in her shell");
  assert.ok(!/hl-gate/.test(hm) && !/hl-door/.test(hm), "her name gate + top-bar door are removed");
  const HLC = require("../scripts/hl-content.js");
  assert.equal(HLC.GATE, undefined, "the gate strings are gone from her content");
});

test("华丽: every hidden game registers through reg() with hl/zh flags and an hl- id", () => {
  let total = 0;
  for (const f of ["scripts/games-hl-a.js", "scripts/games-hl-b.js"]) {
    const src = read(f);
    assert.ok(/def\.hl = true/.test(src) && /def\.lang = "zh"/.test(src) && /def\.hlCat = cat/.test(src) && /def\.homeHash/.test(src),
      f + " must funnel every def through reg() (hl + zh + her category + her Home)");
    assert.ok(!/F\.register\(\{/.test(src),
      f + " must never F.register({...}) directly — only reg(cat, def) applies the hl contract");
    const ids = [...src.matchAll(/\bid: "([^"]+)"/g)].map((m) => m[1]);
    for (const id of ids) assert.match(id, /^hl-/, f + ": game id " + id + " must be hl- prefixed (keeps Josh's world and hers apart)");
    const titles = [...src.matchAll(/\btitle: "([^"]+)"/g)].map((m) => m[1]);
    for (const t of titles) assert.ok(/[\u4e00-\u9fff]/.test(t), f + ': title "' + t + '" must be Chinese');
    total += ids.length;
  }
  assert.equal(total, 40, "her world holds exactly 40 games (20 per file)");
});

test("华丽: the framework speaks her language and main.js keeps the worlds apart", () => {
  const fw = read("scripts/framework.js");
  assert.ok(/def\.lang === "zh"/.test(fw), "the framework must recognise zh game defs");
  assert.ok(/zh-CN/.test(fw), "zh games must speak with the zh-CN voice");
  assert.ok(/HL\.PRAISE/.test(fw) && /HL\.TRYAGAIN/.test(fw), "zh praise/try-again must come from HualiContent");
  assert.ok(/def\.homeHash/.test(fw), "the in-game Home button must honour her homeHash");
  const a = read("scripts/audio.js");
  assert.ok(/opts\.lang/.test(a), "JoshAudio.say must accept a language override");
  const m = read("scripts/main.js");
  assert.ok(/!g\.hl/.test(m), "Josh's launcher/Surprise/book must filter out hl games");
  assert.ok(/josh-won-hl-/.test(m), "Josh's star reset must PRESERVE her josh-won-hl-* progress");
});

// RULE 7 (self-healing): NO emoji newer than Unicode/Emoji 13.0 anywhere in the
// scripts. Josh's device floor is iOS 14.2 (Emoji 13.0); a 13.1/14.0+ emoji
// renders as a blank □ "tofu" box there — invisible to CI (desktop Chromium and
// WebKit render new emoji fine) but a dead picture on his actual iPad. A deep
// audit found 14 such emoji (🫧 bubbles, 🛟 buoy, 🫙 jar, 🛝 slide, 🫗 pour, 🪷
// lotus ×7, 🪭 fan). This generic scan fails if ANY ever returns — in an existing
// game OR a future one. Ranges are the 13.1/14.0/15.x code points not present in
// Emoji 13.0. (Emoji 13.0 blocks — 🪨 1FAA8, 🪵 1FAB5, 🪙 1FA99, 🦬 1F9AC … — are
// deliberately BELOW every blocked range and stay allowed.)
const EMOJI_ABOVE_13 = [
  [0x1F6DC, 0x1F6DF], // wireless, playground slide, wheel, ring buoy (14.0)
  [0x1FA75, 0x1FA77], // light-blue/grey/pink hearts (15.0)
  [0x1FA7B, 0x1FA7F], // x-ray, crutch (14.0) + later
  [0x1FAA9, 0x1FAAF], // mirror ball, ID card, low battery, hamsa, folding fan, hair pick, khanda (14.0/15.0)
  [0x1FAB7, 0x1FABF], // lotus, coral, empty nest, nest w/ eggs, hyacinth (14.0/15.0)
  [0x1FAC3, 0x1FAC6], // pregnant man/person, person with crown (14.0/15.0)
  [0x1FAD7, 0x1FADF], // pouring liquid, beans, jar (14.0) + later
  [0x1FAE0, 0x1FAEF], // melting/saluting/… faces, bubbles (14.0) + later
  [0x1FAF0, 0x1FAF8], // hand gestures — palm up, index pointing at viewer, etc. (14.0) + later
  [0x1F972, 0x1F972], // smiling face with tear (13.1)
  [0x1F978, 0x1F979], // disguised face (13.1), face holding back tears (14.0)
  [0x1F9CC, 0x1F9CC], // troll (14.0)
];
test("guardrail: no emoji newer than Emoji 13.0 (iOS 14.2 floor — no tofu on Josh's iPad)", () => {
  const blocked = (cp) => EMOJI_ABOVE_13.some(([a, b]) => cp >= a && cp <= b);
  const offenders = [];
  for (const f of SCRIPTS) {
    read(f).split("\n").forEach((line, i) => {
      for (const ch of line) {
        const cp = ch.codePointAt(0);
        if (blocked(cp)) offenders.push(`${f}:${i + 1} U+${cp.toString(16).toUpperCase()} ${ch}`);
      }
    });
  }
  assert.deepEqual(offenders, [], `emoji above the iOS 14.2 floor (render as tofu): ${offenders.join(", ")}`);
});

// RULE 7 (self-healing): a CONTENTLESS square that gets its height ONLY from
// `aspect-ratio` collapses to a sliver on Josh's iOS 14.2 iPad — Safari 14 has
// NO aspect-ratio support (added in Safari 15). CI's modern WebKit/Chromium
// hides this, so every aspect-ratio cell MUST pair a real height fallback
// (min-height/height > 0). copy-grid/mirror-half/peek-copy's `.tg__cell` shipped
// with `min-height: 0` and rendered as invisible untappable strips on the real
// device; this scans every CSS rule so no future cell can regress the same way.
test("guardrail: every aspect-ratio cell has a real height fallback (iOS 14.2 has no aspect-ratio)", () => {
  const css = read("styles/main.css");
  const offenders = [];
  // Split into rule blocks "selector { decls }".
  const ruleRe = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = ruleRe.exec(css)) !== null) {
    const sel = m[1].trim(), decls = m[2];
    if (!/aspect-ratio\s*:/.test(decls)) continue;
    const minH = /min-height\s*:\s*([^;]+)/.exec(decls);
    const h = /(?:^|;|\s)height\s*:\s*([^;]+)/.exec(decls);
    const val = (x) => x && x[1].trim();
    const isZero = (v) => v && /^0(\D|$)/.test(v); // "0", "0px", "0 !important"
    const hasReal = (val(minH) && !isZero(val(minH))) || (val(h) && !isZero(val(h)) && val(h) !== "auto");
    if (!hasReal) offenders.push(sel);
  }
  assert.deepEqual(offenders, [], `aspect-ratio cells with no height fallback (collapse on iOS 14.2): ${offenders.join(" | ")}`);
});

// ---------- Syntax ----------
test("all scripts are valid JavaScript", () => {
  for (const f of SCRIPTS) execFileSync(process.execPath, ["--check", path.join(root, f)]);
});

test("guardrail: no NEW flex+gap rule may space tappable children (iOS 14.2 has no flex-gap)", () => {
  // Deep-audit law: Safari 14.0 (Josh's iPad) drops gap in FLEX layout (grid gap
  // works). Every container that spaces tappable children now uses grid or
  // margins. The flex+gap rules below are the audited DECORATIVE survivors
  // (emoji piles, scenes, non-tap art). Adding a new flex+gap rule fails this
  // test: use display:grid (grid-auto-flow: column for a row) or child margins
  // if the children are tappable, else add the selector here with care.
  const ALLOWED = new Set([
    ".add__group",
    ".add__pile",
    ".add__scene",
    ".af__scene",
    ".animal-card",
    ".at__train",
    ".bal__beam",
    ".bal__pan",
    ".bigadd",
    ".bigadd__num",
    ".bigadd__rods",
    ".bounce__pole",
    ".bridge",
    ".bridge__stones",
    ".buddy",
    ".build__tower",
    ".cake__flames",
    ".catcount__scene",
    ".cert__stickers",
    ".clue__bar",
    ".coin__jar",
    ".coin__shop",
    ".coinmix__pile",
    ".conj__clue",
    ".dm__scene",
    ".double__wing",
    ".double__wings",
    ".drum__dots",
    ".dt__train",
    ".find__egs",
    ".find__field--dense",
    ".find__target",
    ".fs__plate",
    ".game__prompt",
    ".glue__parts",
    ".graph__col",
    ".gw__model, .gw__ask",
    ".hl-lineup",
    ".hl-run",
    ".hl-tearow",
    ".hop__path",
    ".house__build",
    ".line__row",
    ".listen__pair",
    ".listen__q",
    ".listen__scene",
    ".ml__word",
    ".more__panel",
    ".more__pond",
    ".mt__car",
    ".muncher__card",
    ".muncher__tower",
    ".nh__slots",
    ".nickel__pile",
    ".ns__slots",
    ".pattern__row",
    ".pattern__seq",
    ".piggy__jar",
    ".pizza__plate",
    ".pizza__plates",
    ".pond__scene",
    ".pv__built",
    ".pv__pile",
    ".race__lane",
    ".race__track",
    ".sandwich__tray",
    ".sb__line",
    ".seesaw",
    ".sentence",
    ".setclock__row",
    ".silly__card",
    ".sort__bin",
    ".spy__target",
    ".sw__window",
    ".table__outlines",
    ".take__scene",
    ".tall__col",
    ".tall__measure",
    ".tc__dots",
    ".tenf",
    ".tenf__extra",
    ".tile",
    ".treasure__chest",
    ".truck__bed",
    ".truck__rig",
    ".tt2__chest",
    ".wh__row",
    ".wi__clues",
    ".word__slots",
    ".wp__path"
  ]);
  const css = read("styles/main.css").replace(/\/\*[\s\S]*?\*\//g, "");
  const rules = css.match(/[^{}]+\{[^{}]*\}/g) || [];
  for (const rule of rules) {
    const sel = rule.slice(0, rule.indexOf("{")).trim().replace(/\s+/g, " ");
    const body = rule.slice(rule.indexOf("{"));
    if (/display:\s*(inline-)?flex/.test(body) && /[^-a-z]gap:/.test(body)) {
      assert.ok(ALLOWED.has(sel),
        `new flex+gap rule "${sel}" — flex-gap is DROPPED on iOS 14.2; use grid (gap works) or child margins for tappable children, or allowlist it if purely decorative`);
    }
  }
});

test("guardrail: app-wide deep-audit fixes stay wired (speech gate, confetti cap, SW hygiene, fort merge)", () => {
  // RULE 7 source-locks for the 27-defect app-wide audit (behavioral tests live
  // in e2e/td/offline suites; these keep the load-bearing lines from vanishing).
  const fw = read("scripts/framework.js");
  assert.match(fw, /const sayLive = \(t\) => \{ if \(!screen\.hidden\)/, "framework speech is gated on screen visibility");
  assert.match(fw, /later\(fn, ms\)/, "api.later exists (auto-cleared timers)");
  assert.match(fw, /screen\.__onHide = \(\) => \{ clearTimers\(\); \}/, "screens clear their timers on hide");
  const mainjs = read("scripts/main.js");
  assert.match(mainjs, /s\.__onHide\) \{ try \{ s\.__onHide\(\); \}/, "route() fires __onHide on the screens it hides");
  assert.match(mainjs, /speechSynthesis\.cancel\(\)/, "route() cancels in-flight speech");
  assert.match(mainjs, /if \(id\) \{ location\.hash = ""; return; \}/, "junk hashes clear the hash (hl theme re-syncs)");
  const fx = read("scripts/effects.js");
  assert.match(fx, /MAX_PIECES/, "confetti pool is capped");
  assert.ok(!/cssText = "position:fixed;inset:0/.test(fx), "no inset: shorthand in JS-injected styles either");
  const sw = read("sw.js");
  assert.match(sw, /res\.ok && \(isNav \|\| !\/text\\\/html\/i\.test\(ct\)\)/, "SW only runtime-caches trustworthy responses (poisoning fix)");
  assert.match(sw, /isNav \? caches\.match\("\.\/index\.html"\) : undefined/, "index.html falls back for NAVIGATIONS only");
  for (const icon of ["./assets/apple-touch-icon.png", "./assets/icon-192.png", "./assets/icon-512.png", "./assets/icon-maskable-512.png"]) {
    assert.ok(sw.includes(icon), `PWA icon ${icon} precached`);
  }
  const tdm = read("scripts/td-main.js");
  assert.match(tdm, /leverRoute: st\.leverRoute \|\| 0/, "the thrown lever rides the midRun checkpoint");
  assert.match(tdm, /e\.state\.leverRoute = mr\.leverRoute \|\| 0/, "resume restores the thrown lever");
  assert.match(tdm, /opts && opts\.force/, "persist() merges monotonic fields unless a deliberate reset forces");
  const hlm = read("scripts/hl-main.js");
  assert.match(hlm, /getElementById\("screen-" \+ h\)/, "hl theme only paints for REAL hl screens");
  const tdr = read("scripts/td-render.js");
  assert.match(tdr, /RULES\.leverCooldown \|\| 8/, "the lever cooldown ring reads the ONE RULES constant");
});
