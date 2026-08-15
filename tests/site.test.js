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
  // Per-difficulty ladders (user request 2026-07): a legacy flat map migrates to
  // normal, a win lands on the RUN's difficulty, the grid shows the SELECTED
  // ladder, and the tree/endless economy reads BEST-across (ceiling stays 36).
  assert.match(main, /save\.stars\.normal\[k\] = Math\.min\(3, v\)/, "a legacy flat stars map migrates into the normal ladder at boot");
  assert.match(main, /save\.stars\[st\.difficulty\]/, "a win writes the star to the RUN's difficulty ladder");
  assert.match(main, /function bestStarsOf\(/, "meta aggregates read best-per-level across ladders");
  const tdui2 = read("scripts/td-ui.js");
  assert.match(tdui2, /save\.stars && save\.stars\[selDiff\]/, "the level grid shows the SELECTED difficulty's ladder");
  assert.match(tdui2, /bestStarsOf\(save, String\(id\)\) >= 3/, "endless unlock reads best-across stars");
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
  // Lever readability (user feedback 2026-07): its state must be readable on the
  // FIELD — running lights along the active route, a veil on the closed branch,
  // and a state tag on the button. leverInfo() is the render hook the browser
  // test drives. TD-17: the switch became a TIMED diversion, so the button is
  // also a clock — it names all three states and paints the seconds remaining.
  assert.match(render, /function drawLeverRoute\(/, "the active-route overlay exists");
  assert.match(render, /lineDashOffset/, "the active route is lit with running dashes");
  assert.match(render, /"LONG WAY"/, "the lever names the diverted route");
  assert.match(render, /"TAP: LONG WAY"/, "…and says so when it is ARMED, or it reads as fire-and-forget");
  assert.match(render, /engine\.leverState\(\)/, "the button reads the engine's lever clock, never its own copy");
  assert.match(render, /Math\.ceil\(ls\.secs\)/, "the seconds remaining are DRAWN on the switch (the user asked for a visible timer)");
  assert.match(render, /leverInfo:/, "the renderer exposes the leverInfo test hook");
  const main = read("scripts/td-main.js");
  assert.match(main, /engine\.pullLever\(\)/, "a field tap on the lever throws it");
});

test("guardrail: the TD-8 deep star tree stays wired (branches, ranks, one site per ability)", () => {
  const data = require("../scripts/td-data.js");
  assert.equal((data.META_BRANCHES || []).length, 3, "3 tree branches");
  assert.ok(data.META_NODES.length >= 23, "the deep tree keeps its 23+ nodes");
  const logic = read("scripts/td-logic.js");
  assert.match(logic, /diff\.bounty \* mods\.bounty/, "Bounty Hunter multiplies at the ONE killEnemy site");
  assert.match(logic, /mods\.bossDmg > 1 && enemyDef\(e\)\.boss/, "Boss Bonker applies in the ONE dealDamage path");
  assert.match(logic, /mods\.stickerShield && !state\.shieldUsed/, "Sticker Shield absorbs exactly one leak");
  assert.match(logic, /const respawnTicks = /, "Guard Dog scales BOTH soldier-KO paths through one helper");
  assert.match(logic, /mods\.nightOwl \? 1 - \(1 - nightBase\) \/ 2/, "Night Owl halves the night penalty");
  assert.match(read("scripts/td-render.js"), /engine\.rangeMul/, "the range preview reads the ENGINE's night multiplier (Night Owl included)");
  const tui = read("scripts/td-ui.js");
  assert.match(tui, /function cascadeConsistent\(/, "refunds cascade so owned nodes stay self-consistent");
  // TD-8 audit fixes: the tree overlay preserves scroll across a buy/refund
  // rebuild (else a tall 23-node tree jumps to top every tap on a phone), and a
  // spent Sticker Shield rides the resume checkpoint (else the free leak re-grants).
  assert.match(tui, /keepScroll|box\.scrollTop/, "the star-tree rebuild preserves scroll position");
  const tmain = read("scripts/td-main.js");
  assert.match(tmain, /shieldUsed: !!st\.shieldUsed/, "writeMidRun checkpoints a spent Sticker Shield");
  assert.match(tmain, /e\.state\.shieldUsed = !!mr\.shieldUsed/, "resumeMidRun restores the spent Sticker Shield");
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
  // A CSS `filter` must never land on a selector the page renders BY THE HUNDRED.
  // The Sticker Book holds 200 `.sticker-slot__art` SVGs, and desaturating the
  // unearned ones with `grayscale(1)` forced each subtree into its own
  // rasterization pass — a known WebKit compositing cliff. CI's real-WebKit run
  // stalled for over an hour on it while the local suite passed in 17 seconds,
  // because WebKit is not installed in the dev sandbox and mobile.test.js falls
  // back to Chromium. That is precisely the documented reason never to trust a
  // Chromium-only measurement for an iOS surface — so the law is mechanical now.
  // If a bulk-rendered element genuinely needs one, it joins this list knowingly.
  // Scoped to the case that actually bit: a filter on a container of DRAWN ART
  // (an inline SVG), rendered by the hundred. A `drop-shadow` on a small glyph is
  // a different animal — `.tile__badge` puts one on a 1.25rem ⭐ and has been
  // green in CI for dozens of runs — and a checker that flags proven-fine design
  // is one nobody reads, so it is allowlisted with that reason rather than the
  // law being watered down.
  const ART_BULK = ["sticker-slot__art", "find__dot--art", "art-fill", "choice__art", "tile__art"];
  const FILTER_OK = ["tile__badge"];   // small text glyph, not an SVG subtree
  for (const file of ["styles/main.css", "styles/td.css"]) {
    const body = read(file).replace(/\/\*[\s\S]*?\*\//g, "");
    for (const rule of body.split("}")) {
      const parts = rule.split("{");
      if (parts.length < 2) continue;
      const sel = parts[0], decls = parts[1] || "";
      if (!/(^|[^-a-z])(-webkit-)?filter\s*:\s*(?!none)/.test(decls)) continue;
      if (FILTER_OK.some((ok) => sel.indexOf(ok) >= 0)) continue;
      const hit = ART_BULK.find((b) => sel.indexOf(b) >= 0);
      assert.ok(!hit,
        `${file}: "${sel.trim()}" wraps drawn SVG art rendered in bulk and declares a filter — 200 filtered subtrees is a WebKit rasterization cliff a Chromium-only local run cannot see (it stalled CI for an hour while passing locally in 17s). Use opacity/colour instead.`);
    }
  }
  // Safari 14.0 also lacks the `inset:` shorthand (14.1) — longhands only.
  for (const file of ["styles/main.css", "styles/td.css"]) {
    const body = read(file).replace(/\/\*[\s\S]*?\*\//g, "");
    assert.ok(!/[^-a-z]inset\s*:/.test(body), `${file}: use top/right/bottom/left longhands, never the inset: shorthand (dropped on iOS 14.2)`);
  }
  // A full-screen MODAL SCRIM must be `position: fixed`, never `absolute`.
  // Absolute positions it against its host, and a host screen is as tall as its
  // content — the fort home grew to ~1250px when World 4 became reachable, which
  // centred every fort dialog hundreds of pixels below the fold. The signature of
  // a scrim is: all four offsets zeroed, flex-centred, and a modal z-index — an
  // in-stage game overlay never sets one that high, so it stays exempt.
  for (const file of ["styles/main.css", "styles/td.css"]) {
    const body = read(file).replace(/\/\*[\s\S]*?\*\//g, "");
    for (const chunk of body.split("}")) {
      const sel = (chunk.split("{")[0] || "").trim();
      const decls = chunk.split("{").pop() || "";
      if (!/top:\s*0/.test(decls) || !/right:\s*0/.test(decls) || !/bottom:\s*0/.test(decls) || !/left:\s*0/.test(decls)) continue;
      if (!/display:\s*flex/.test(decls) || !/align-items:\s*center/.test(decls)) continue;
      const z = (decls.match(/z-index:\s*(\d+)/) || [])[1];
      if (!z || Number(z) < 20) continue;
      assert.match(decls, /position:\s*fixed/,
        `${file}: "${sel}" is a full-screen modal scrim (z-index ${z}) — it must be position: fixed, or it centres on its host screen instead of the viewport`);
    }
  }
  assert.match(css, /env\(safe-area-inset/, "respect the notch");
  assert.match(css, /-webkit-backdrop-filter/, "Safari needs -webkit-backdrop-filter");
  assert.match(css, /touch-action:\s*manipulation/, "prevent double-tap zoom");
  assert.match(css, /-webkit-tap-highlight-color/, "remove the iOS tap highlight");
  // THE OTHER HALF of "the page must not move under a thumb". `touch-action`
  // stops the double-tap zoom but nothing else: the rubber-band bounce, and
  // pull-to-refresh (which can RELOAD the page mid-round and drop it), and
  // scroll CHAINING out of an inner scroller onto the page behind an open
  // dialog. `overscroll-behavior: none` on the root kills all three and cannot
  // touch pinch-zoom, so the deliberate "stop the ACCIDENTAL zoom, never ban
  // zooming" accessibility choice is preserved.
  {
    // There is more than one `html, body` rule, so ask whether ANY of them
    // declares it rather than trusting the first match.
    const roots = css.split("}").filter((r) => /(^|[\s;*/])html\s*,\s*body\s*\{/.test(r + "{"));
    assert.ok(roots.length, "found the html, body rule(s)");
    assert.ok(roots.some((r) => /overscroll-behavior:\s*none/.test(r)),
      "html, body must set overscroll-behavior: none — otherwise a drag past the top or bottom rubber-bands the page, and pull-to-refresh can reload mid-round");
  }
  // …and every INNER scroller must contain its own overscroll, or reaching its
  // end hands the rest of the gesture to the page and slides the whole screen
  // behind the dialog you are reading.
  for (const file of ["styles/main.css", "styles/td.css"]) {
    const body = read(file).replace(/\/\*[\s\S]*?\*\//g, "");
    for (const rule of body.split("}")) {
      const parts = rule.split("{");
      if (parts.length < 2) continue;
      const sel = parts[0], decls = parts[1] || "";
      if (!/overflow-y:\s*(auto|scroll)/.test(decls)) continue;
      assert.match(decls, /overscroll-behavior:\s*contain/,
        `${file}: "${sel.trim()}" scrolls internally, so it must also declare overscroll-behavior: contain — otherwise scrolling to its end drags the page behind it`);
    }
  }
});

test("an absolutely-positioned ::after has a POSITIONED parent, and new animations honour reduced motion", () => {
  // (1) An absolutely-positioned pseudo-element on a STATIC parent escapes to the
  //     nearest positioned ancestor — the same class of bug as the .td-overlay
  //     absolute-vs-fixed finding, where a scrim centred on its host screen
  //     instead of the viewport. The sort bin's drop-lip is the first pseudo in
  //     the app to rely on this, so make it a law rather than a one-off.
  // (2) RULE 5: every new keyframe must be listed in the reduced-motion block.
  //     The repo already disables .win-hero / .mascot--cheer / .sticker-slot.plop
  //     there; an animation that skips it is a regression, not an oversight.
  for (const file of ["styles/main.css", "styles/td.css"]) {
    const body = read(file).replace(/\/\*[\s\S]*?\*\//g, "");
    const rules = body.split("}");
    for (let i = 0; i < rules.length; i++) {
      const parts = rules[i].split("{");
      if (parts.length < 2) continue;
      const sel = parts[0].trim(), decls = parts[1] || "";
      const m = /^(.*?)::(after|before)$/.exec(sel.split(",")[0].trim());
      if (!m || !/position:\s*absolute/.test(decls)) continue;
      const parent = m[1].trim();
      const parentRule = rules.find((r) => {
        const p2 = r.split("{");
        return p2.length > 1 && p2[0].split(",").some((x) => x.trim() === parent);
      });
      assert.ok(parentRule && /position:\s*(relative|absolute|fixed|sticky)/.test(parentRule.split("{")[1] || ""),
        `${file}: "${sel}" is absolutely positioned, so "${parent}" must be positioned too — otherwise the pseudo escapes to the nearest positioned ancestor and lands somewhere else entirely`);
    }
  }
  // Every @keyframes must be reachable from its own stylesheet's
  // reduced-motion block through at least one selector that uses it.
  //
  // SCOPE. This read `styles/main.css` ONLY — so `styles/td.css`'s four fort
  // animations (td-bump / td-shake / td-bannerpop / td-toastpop) were never
  // audited by the very law written to stop an animation shipping ungated.
  // All four happen to comply, so this was a latent hole rather than a live
  // defect, but a FIFTH fort animation could ship with no off switch and
  // nothing would notice. That is the fifth instance of the class this repo
  // keeps paying for — the flex-gap law guarded only main.css, the VS16 scan
  // hand-listed nine files, the live-verify probe hit only index.html,
  // FIELD_TRAIT hand-listed twelve fields, the overlay audit hand-listed six
  // dialogs. When a list can go stale, derive it.
  const SHEETS = ["styles/main.css", "styles/td.css"];
  let kfChecked = 0;
  // Collect the CONTENTS of every reduced-motion at-rule, not a slice from the
  // first one. main.css keeps a single block at the end, so slicing worked
  // there by luck; td.css puts an off switch inline beside each animation, so
  // a slice-to-end swallows the rest of the file and matches the animation's
  // OWN normal rule — the check then cannot fail. (Proven: deleting
  // td-toastpop's off switch left the slice version green.)
  const reducedBlocks = (css) => {
    let out = "";
    const needle = "@media (prefers-reduced-motion: reduce)";
    for (let i = css.indexOf(needle); i >= 0; i = css.indexOf(needle, i + 1)) {
      const open = css.indexOf("{", i);
      if (open < 0) break;
      let depth = 0, j = open;
      for (; j < css.length; j++) {
        if (css[j] === "{") depth++;
        else if (css[j] === "}") { depth--; if (!depth) break; }
      }
      out += css.slice(open, j) + "\n";
    }
    return out;
  };
  for (const sheet of SHEETS) {
    const css = read(sheet);
    const reduced = reducedBlocks(css);
    for (const kf of (css.match(/@keyframes\s+([\w-]+)/g) || []).map((k) => k.split(/\s+/)[1])) {
      const users = (css.match(new RegExp("[^{}]+\\{[^{}]*animation[^;}]*" + kf + "\\b[^;}]*", "g")) || [])
        .map((r) => r.split("{")[0].trim()).filter(Boolean);
      if (!users.length) continue;                       // an unused keyframe animates nothing
      const named = users.some((sel) => sel.split(",").some((one) => {
        const cls = (one.trim().match(/\.[\w-]+/g) || []).pop();
        return cls && reduced.indexOf(cls) >= 0;
      }));
      assert.ok(named, `${sheet}: @keyframes ${kf} animates ${users.join(" / ")} but nothing in that file's prefers-reduced-motion block turns it off`);
      kfChecked += 1;
    }
  }
  // …and the sweep is not vacuous — the fort's own animations must be among
  // what it checked, or a refactor that moved them elsewhere would silently
  // shrink the scan back to one file.
  assert.ok(kfChecked >= 30, `only ${kfChecked} animated keyframes were checked across ${SHEETS.join(" + ")}`);
  assert.ok(/@keyframes\s+td-/.test(read("styles/td.css")), "the fort stylesheet must be in the scan's scope");
  const css = read("styles/main.css");   // the tile-gradient law below is Josh's world only
  // A gradient with a TRANSLUCENT stop, laid on a tile with the `background`
  // SHORTHAND, resets background-color to transparent — so that stop composites
  // over whatever is behind the tile, which is the page gradient. That cost
  // Josh's category colours their constancy (the same white label measured
  // #586c71 on one tile and #765d5d on another purely from vertical position)
  // and it wiped 华丽's colours out entirely, because a later cream rule at
  // equal specificity simply won. An OPAQUE gradient is safe and stays exempt.
  for (const chunk of css.replace(/\/\*[\s\S]*?\*\//g, "").split("}")) {
    const sel = (chunk.split("{")[0] || "").trim();
    const decls = chunk.split("{").pop() || "";
    if (!/\.tile--/.test(sel) || /\.tile__/.test(sel)) continue; // the card, not its label pill
    const grad = (decls.match(/gradient\([^;]*/) || [])[0];
    if (!grad || !/rgba\([^)]*,\s*0?\.\d+\s*\)|\btransparent\b/.test(grad)) continue;
    assert.ok(/background-color\s*:/.test(decls),
      `main.css: "${sel}" paints a gradient with a TRANSLUCENT stop on a tile — declare background-color and background-image as LONGHANDS, never the \`background\` shorthand, or that stop composites over the page gradient and the tile's colour drifts with its position`);
  }
  // 华丽's page is a gradient that ENDS in gold, and cream ink can never pass
  // AA on that end (L(#ffe9b0) = 0.827 needs a background luminance <= 0.145;
  // the gold is 0.423). So a cream run in her world must carry its own plate.
  // Measured before the plate landed: .music__hint 2.02:1, .hl-calmlabel
  // 3.44:1, .hl-diffvs 4.40:1 — all simply labels that sat low on the page.
  // The exemption is a cream run whose ANCESTOR carries the plate — it must
  // NAME that ancestor rule, and that rule is then checked for a real
  // background, so the list cannot become a dumping ground.
  const PLATED_BY = {
    "body.hl-mode .brand": "body.hl-mode .topbar", // 10.39:1 on the bar's own plum plate
  };
  const hlBlock = css.slice(css.indexOf("华丽的世界")).replace(/\/\*[\s\S]*?\*\//g, "");
  const hlRules = hlBlock.split("}").map((c) => [(c.split("{")[0] || "").trim(), c.split("{").pop() || ""]);
  const remIsLarge = (decls) => {
    const m = /font-size:\s*(?:clamp\(\s*)?([\d.]+)rem/.exec(decls);
    if (!m) return false;                              // no size here — assume body text
    const px = parseFloat(m[1]) * 16;
    const bold = (parseInt((/font-weight:\s*(\d+)/.exec(decls) || [])[1], 10) || 400) >= 700;
    return px >= 24 || (px >= 18.66 && bold);          // WCAG "large text" — a 3.0 bar
  };
  for (const [sel, decls] of hlRules) {
    if (!/color:\s*(#ffe9b0|#fff8ec)\b/i.test(decls)) continue;
    if (/background/.test(decls)) continue;
    if (remIsLarge(decls)) continue;                   // 3.0 bar, and measured clear
    const host = PLATED_BY[sel];
    assert.ok(host,
      `main.css: "${sel}" paints cream text inside 华丽's world with no background of its own — on the gold end of her page gradient that can never reach AA. Give it the shared dark plate, or add it to PLATED_BY naming the ancestor that plates it.`);
    const hostRule = hlRules.find(([s]) => s === host);
    assert.ok(hostRule && /background/.test(hostRule[1]),
      `main.css: "${sel}" is exempted because "${host}" plates it — but "${host}" declares no background`);
  }
});

test("the fort's ⚙️ Toy Energy actually says what it is", () => {
  // Shipped as a bare gear numeral in the HUD, on every ability button and in
  // the guide's cost lines — and NOTHING in the app ever named it. The owner's
  // first question on seeing it was "what does the gear mean?", which is the
  // same defect TD-12 fixed for the abilities, whose names lived only inside an
  // aria-label. A symbol the player cannot decode is a mechanic they cannot plan
  // around, which is the entire reason this resource exists.
  const ui = read("scripts/td-ui.js");
  assert.match(ui, /td-hud__charge"[^>]*title="[^"]*Toy Energy/i,
    "the HUD's ⚙️ chip must name Toy Energy on hover");
  assert.match(ui, /setAttribute\("aria-label", *\(state\.charge[^)]*\)[^;]*toy energy/i,
    "…and to a screen reader, with the live value");
  const guide = ui.slice(ui.indexOf("Powers — usable during a wave only"), ui.indexOf("The wave button"));
  assert.match(guide, /Toy Energy/, "the guide's Powers section must define ⚙️, not just spend it");
  assert.match(guide, /RULES\.chargePerWave/, "…quoting the engine's own per-wave grant, never a re-typed number");
  assert.match(guide, /RULES\.chargeMax/, "…and its own cap");
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

// RULE 7 (self-healing), the same iOS-14.2 floor one layer down: the CANVAS 2D
// API has a floor too, and it is invisible in CI for the identical reason the
// CSS ones were — Chromium and CI's modern WebKit both have these, Josh's iPad
// does not, so a bare call ships green and throws on the one device that
// matters. `roundRect` is Safari 16 and is used by the tower art; `filter` is
// Safari 17 AND is this project's documented rasterization cliff. Both must be
// feature-checked at their call site, exactly as the ink line's `canInk` probe
// already does for the fillStyle accessor.
//   Derived from the same SCRIPTS list as the emoji scan — a scan's own file
// list is part of the scan, and that lesson has been paid for three times here.
test("guardrail: a Safari-16+ canvas call is feature-checked (iOS 14.2 floor)", () => {
  const FLOORED = ["roundRect", "conicGradient", "createConicGradient", "reset"];
  const offenders = [];
  for (const f of SCRIPTS) {
    const src = read(f);
    for (const api of FLOORED) {
      // PER CALL SITE, not per file. The first cut asked whether the name was
      // guarded anywhere in the file, which is unfalsifiable the moment one use
      // is guarded: td-render.js already had two ternary-guarded roundRects, so
      // deleting the guard on a THIRD stayed green. Caught by mutating it, which
      // is the only way this class ever gets caught.
      //   The guard must be on the same line as the call — `if (ctx.x) ctx.x(…)`
      // or `ctx.x ? ctx.x(…) : …` — which is how all the shipped uses read.
      src.split("\n").forEach((line, i) => {
        if (!new RegExp(`ctx\\.${api}\\s*\\(`).test(line)) return;
        const guarded = new RegExp(`(if\\s*\\(\\s*ctx\\.${api}\\s*\\)|typeof\\s+ctx\\.${api}|ctx\\.${api}\\s*\\?)`).test(line);
        if (!guarded) offenders.push(`${f}:${i + 1} ctx.${api}()`);
      });
    }
    if (/ctx\.filter\s*=/.test(src)) offenders.push(`${f}: ctx.filter is Safari 17 AND the documented WebKit rasterization cliff`);
  }
  assert.deepEqual(offenders, [],
    `these canvas calls are newer than Safari 14.0, so they throw or no-op on Josh's iPad while passing in CI's modern browsers — feature-check them with a fallback: ${offenders.join(", ")}`);
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
  // The FORT's stylesheet was never scanned — the guardrail read main.css only,
  // so all 16 of td.css's flex+gap rules shipped unaudited, and on Josh's iPad
  // the top bar's buttons, the tower panel, the difficulty chips and every
  // dialog's button row (Leave / Keep playing) sat flush against each other.
  // Its survivors are card/HUD internals: one tappable card's own contents, or
  // text that is never tapped at all.
  const ALLOWED_TD = new Set([
    ".td-ach",       // badge card internals (icon / name / desc)
    ".td-buy",       // inside ONE build button (icon / role / price)

    ".td-level",     // inside ONE level card (number / name / stars)
    ".td-node",      // inside ONE star-tree button (icon / body / cost)
    ".td-toast",     // pointer-events: none by design
  ]);
  for (const [file, allow] of [["styles/main.css", ALLOWED], ["styles/td.css", ALLOWED_TD]]) {
    const css = read(file).replace(/\/\*[\s\S]*?\*\//g, "");
    const rules = css.match(/[^{}]+\{[^{}]*\}/g) || [];
    for (const rule of rules) {
      const sel = rule.slice(0, rule.indexOf("{")).trim().replace(/\s+/g, " ");
      const body = rule.slice(rule.indexOf("{"));
      if (/display:\s*(inline-)?flex/.test(body) && /[^-a-z]gap:/.test(body)) {
        assert.ok(allow.has(sel),
          `new flex+gap rule "${sel}" in ${file} — flex-gap is DROPPED on iOS 14.2; use grid (gap works) or child margins for tappable children, or allowlist it if purely decorative`);
      }
    }
  }
  // …and a `gap` on a selector that INHERITS display:flex is the same bug with
  // no `display` to spot it. td.css's `.td-bar--play` carried one: 8px that a
  // modern browser ADDED to the child margins and iOS 14.2 dropped entirely.
  const tdRaw = read("styles/td.css").replace(/\/\*[\s\S]*?\*\//g, "");
  for (const rule of tdRaw.match(/[^{}]+\{[^{}]*\}/g) || []) {
    const sel = rule.slice(0, rule.indexOf("{")).trim().replace(/\s+/g, " ");
    const body = rule.slice(rule.indexOf("{"));
    if (!/[^-a-z]gap:/.test(body) || /display:\s*(grid|inline-grid)/.test(body)) continue;
    if (/display:\s*(inline-)?flex/.test(body)) continue; // handled above
    assert.ok(!/^\.td-bar/.test(sel),
      `"${sel}" sets gap but inherits display:flex — iOS 14.2 drops it; use child margins`);
  }
});

test("guardrail: a PICTURE emoji must carry VS16 (text-default ones render monochrome)", () => {
  // Some emoji default to TEXT presentation (Emoji_Presentation=No): without a
  // trailing U+FE0F they render as a thin monochrome glyph, not the colour
  // picture. The fort shipped nine of them — the Plastic Knight's 🛡, the Bed
  // Monster's 🛏 (also the bedroom's spawn marker ON the battlefield), the Couch
  // Cushion's 🛋, the Vacuum King's 🌪, the Attic's 🕯 (a bare sliver), the HUD's
  // ❤, the Fan's ❄, the summary's 🏗 and the boss klaxon's ⚠ — while the SAME
  // heart and shield were written correctly (❤️ 🛡️) a few lines away, which is
  // what gives it away as an accident rather than a choice. Same class as the
  // "no emoji newer than 13.0" scan: how a glyph actually renders on the device
  // is part of correctness.
  const TEXT_DEFAULT = new Set([
    0x203C, 0x2049, 0x2122, 0x2139, 0x2194, 0x2195, 0x2196, 0x2197, 0x2198, 0x2199, 0x21A9, 0x21AA,
    0x2328, 0x23CF, 0x23ED, 0x23EE, 0x23EF, 0x23F1, 0x23F2, 0x23F8, 0x23F9, 0x23FA, 0x24C2,
    0x25AA, 0x25AB, 0x25B6, 0x25C0, 0x25FB, 0x25FC, 0x2600, 0x2601, 0x2602, 0x2603, 0x2604,
    0x260E, 0x2611, 0x2618, 0x261D, 0x2620, 0x2622, 0x2623, 0x2626, 0x262A, 0x262E, 0x262F,
    0x2638, 0x2639, 0x263A, 0x2640, 0x2642, 0x265F, 0x2660, 0x2663, 0x2665, 0x2666, 0x2668,
    0x267B, 0x267E, 0x2692, 0x2694, 0x2695, 0x2696, 0x2697, 0x2699, 0x269B, 0x269C, 0x26A0,
    0x26B0, 0x26B1, 0x26C8, 0x26CF, 0x26D1, 0x26D3, 0x26E9, 0x26F0, 0x26F1, 0x26F4, 0x26F7,
    0x26F8, 0x26F9, 0x2702, 0x2708, 0x2709, 0x270C, 0x270D, 0x270F, 0x2712, 0x2714, 0x2716,
    0x271D, 0x2721, 0x2733, 0x2734, 0x2744, 0x2747, 0x2763, 0x2764, 0x27A1, 0x2934, 0x2935,
    0x2B05, 0x2B06, 0x2B07, 0x1F321, 0x1F324, 0x1F325, 0x1F326, 0x1F327, 0x1F328, 0x1F329,
    0x1F32A, 0x1F32B, 0x1F32C, 0x1F336, 0x1F37D, 0x1F396, 0x1F397, 0x1F399, 0x1F39A, 0x1F39B,
    0x1F39E, 0x1F39F, 0x1F3CB, 0x1F3CC, 0x1F3CD, 0x1F3CE, 0x1F3D4, 0x1F3D5, 0x1F3D6, 0x1F3D7,
    0x1F3D8, 0x1F3D9, 0x1F3DA, 0x1F3DB, 0x1F3DC, 0x1F3DD, 0x1F3DE, 0x1F3DF, 0x1F3F3, 0x1F3F5,
    0x1F3F7, 0x1F43F, 0x1F441, 0x1F4FD, 0x1F549, 0x1F54A, 0x1F56F, 0x1F570, 0x1F573, 0x1F574,
    0x1F575, 0x1F576, 0x1F577, 0x1F578, 0x1F579, 0x1F587, 0x1F58A, 0x1F58B, 0x1F58C, 0x1F58D,
    0x1F590, 0x1F5A5, 0x1F5A8, 0x1F5B1, 0x1F5B2, 0x1F5BC, 0x1F5C2, 0x1F5C3, 0x1F5C4, 0x1F5D1,
    0x1F5D2, 0x1F5D3, 0x1F5DC, 0x1F5DD, 0x1F5DE, 0x1F5E1, 0x1F5E3, 0x1F5E8, 0x1F5EF, 0x1F5F3,
    0x1F5FA, 0x1F6CB, 0x1F6CD, 0x1F6CE, 0x1F6CF, 0x1F6E0, 0x1F6E1, 0x1F6E2, 0x1F6E3, 0x1F6E4,
    0x1F6E5, 0x1F6E9, 0x1F6F0, 0x1F6F3,
  ]);
  // DELIBERATELY monochrome: these are control glyphs on a coloured button, and
  // a boxed colour emoji would look worse. Anything not on this list is a
  // picture and must be explicit about wanting colour.
  const UI_GLYPHS = new Set([0x25B6, 0x23F8, 0x21A9, 0x2194, 0x2B06, 0x23F1]);
  const strip = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
  // EVERY shipped script, derived from the same SCRIPTS list the ≤13.0 scan
  // uses — not a hand-written subset. The subset omitted `td-logic.js`, and the
  // Toybox Guide's trait lines live there: the Plastic Knight's 🛡 and the Couch
  // Cushion's 🛋 were re-introduced without VS16 and shipped past a green scan.
  // Exactly the "a stylesheet-scoped guardrail only guards that stylesheet"
  // lesson, one directory over. A scan's FILE LIST is part of the scan.
  const files = ["index.html", ...SCRIPTS];
  const bad = [];
  for (const f of files) {
    const cps = Array.from(strip(read(f)));
    for (let i = 0; i < cps.length; i++) {
      const cp = cps[i].codePointAt(0);
      if (!TEXT_DEFAULT.has(cp) || UI_GLYPHS.has(cp)) continue;
      if (cps[i + 1] && cps[i + 1].codePointAt(0) === 0xFE0F) continue;
      bad.push(f + ": U+" + cp.toString(16).toUpperCase() + " " + cps[i] + " (" + cps.slice(Math.max(0, i - 12), i + 8).join("").replace(/\n/g, " ") + ")");
    }
  }
  assert.deepEqual(bad, [],
    "picture emoji rendering as a monochrome glyph — append U+FE0F (️) or pick a colour-presentation emoji:\n" + bad.join("\n"));
});

test("guardrail: app-wide deep-audit fixes stay wired (speech gate, confetti cap, SW hygiene, fort merge)", () => {
  // RULE 7 source-locks for the 27-defect app-wide audit (behavioral tests live
  // in e2e/td/offline suites; these keep the load-bearing lines from vanishing).
  const fw = read("scripts/framework.js");
  assert.match(fw, /const live = \(\) => !screen\.hidden;/, "there is ONE 'is this game on screen' predicate");
  assert.match(fw, /const sayLive = \(t\) => \{ if \(live\(\)\)/, "framework speech is gated on screen visibility");
  // MEASURED 2026-08: winCue/goodCue/bumpCue and every spoken line were gated,
  // and the two lines BETWEEN them — FX.confetti() and FX.stars() — were not, so
  // a game that defers its win behind a raw timer rained confetti over the
  // launcher (proven on color-number / drive-home / how-tall / sink-float). Every
  // celebration now goes through the same `cue()`; a bare call is the regression.
  assert.match(fw, /const cue = \(fn\) => \{ try \{ if \(live\(\)\) fn\(\); \}/, "one owner for every celebration cue");
  for (const line of fw.split("\n")) {
    if (line.trim().startsWith("//")) continue;
    if (!/FX\.(confetti|stars)\s*\(/.test(line)) continue;
    assert.match(line, /cue\(/, `framework fires a celebration outside cue(): ${line.trim()}`);
  }
  for (const c of ["winCue", "goodCue", "bumpCue"]) {
    assert.match(fw, new RegExp(`cue\\(\\(\\) => A\\.${c} && A\\.${c}\\(\\)\\)`), `${c} goes through cue()`);
  }
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
  // TD8 targeting has ONE owner: the button asks the engine which modes this run
  // allows and honours the result, instead of re-deriving "cheap" from save.meta
  // (which is a different source of truth from the engine's createEngine-time
  // `mods`, so the two could disagree and the label could lie).
  assert.match(tdm, /cur\.engine\.targetingModes\(\)/, "the targeting cycle asks the ENGINE for its legal modes");
  assert.ok(!/indexOf\("cheaptarget"\)/.test(tdm), "…and no longer re-derives the gated mode from save.meta");

  // TD-17: the diversion is TIMED, so it deliberately does NOT ride the
  // checkpoint — saving the route without its expiry tick would restore a
  // diversion that never ends (the free-upgrade this phase removed).
  assert.ok(!/leverRoute: st\.leverRoute/.test(tdm), "a TIMED diversion must not be written into the checkpoint");
  assert.match(tdm, /e\.state\.leverRoute = 0;\s*e\.state\.leverUntil = 0;\s*e\.state\.leverCd = 0;/,
    "a resumed run comes back on the short route with the lever armed");
  assert.match(tdm, /opts && opts\.force/, "persist() merges monotonic fields unless a deliberate reset forces");
  const hlm = read("scripts/hl-main.js");
  assert.match(hlm, /getElementById\("screen-" \+ h\)/, "hl theme only paints for REAL hl screens");
  const tdr = read("scripts/td-render.js");
  // TD-17: the ring now spans EITHER the hold or the cooldown depending on the
  // phase, and both come from RULES — never a literal duplicated in the renderer.
  assert.match(tdr, /RU = global\.TDData\.RULES/, "the lever ring reads RULES, never its own copy of the timings");
  assert.match(tdr, /RU\.leverHold \|\| 10/, "the diversion ring spans the ONE hold constant");
  assert.match(tdr, /RU\.leverCooldown \|\| 10/, "the re-arm ring spans the ONE cooldown constant");
});

// RULE 7 — the fort reset has ONE owner. This closes the save-field-coverage
// bug class documented twice already (`save.ach`, then `save.stars`): a reset
// path that misses a newly-persisted field leaves it `undefined` and the next
// win crashes on it. The grown-ups ⚙️ button and the __TD test hook must both
// build the fresh save in the SAME place, and it must cover every field the
// loader coerces at boot.
test("guardrail: the fort reset has one owner, forces past the merge, and covers every persisted field", () => {
  const tdm = read("scripts/td-main.js");
  assert.match(tdm, /function freshSave\(/, "a single freshSave() factory builds the reset save");
  assert.match(tdm, /function resetProgress\(/, "a single resetProgress() owns the wipe");
  assert.match(tdm, /resetSave: \(\) => resetProgress\(/,
    "the __TD test hook routes through the ONE owner (never its own literal, which would drift)");
  assert.match(tdm, /resetSave: \(\) => resetProgress\(\{ dropRun: true \}\)/,
    "…and drops the parked run, or the next navigation re-checkpoints the run it just wiped");
  assert.match(tdm, /resetFort: \(\) => \{/, "the fort home's grown-ups reset is wired to a hook");
  assert.match(tdm, /resetProgress\(\{ keepPrefs: true, dropRun: true \}\)/,
    "the grown-ups reset keeps preferences and drops any parked run");
  // The reset MUST force: persist() otherwise folds the stored copy's monotonic
  // fields (stars / ach / endlessBest) straight back in and the wipe is a no-op.
  const body = tdm.slice(tdm.indexOf("function resetProgress("), tdm.indexOf("function resetProgress(") + 600);
  assert.match(body, /persist\(save, \{ force: true \}\)/, "a deliberate reset skips the two-tab monotonic merge");
  // Every field the boot loader coerces must appear in freshSave — and the LIST
  // IS DERIVED from the loader itself. It used to be seven hand-written names,
  // which is the defect class this repo keeps paying for ("a scan's own list is
  // part of the scan"): `save.bests`, `save.loadout` and `save.powers` all
  // landed after that list was written and none of them was covered by it. The
  // same gap in the loader's own defaults is what crashed the first win twice
  // (save.ach, then save.stars). Now a new persisted field is covered the
  // moment it is coerced at boot.
  const fresh = tdm.slice(tdm.indexOf("function freshSave("), tdm.indexOf("function resetProgress("));
  const coerced = new Set();
  for (const line of tdm.split("\n")) {
    let m = /^\s*if \(.*\bsave\.([A-Za-z]+)\b.*\)\s*save\.\1 =/.exec(line);        // if (!Array.isArray(save.x)) save.x = …
    if (!m) m = /^\s*if \(!\("([A-Za-z]+)" in save\)\)\s*save\.\1 =/.exec(line);   // if (!("midRun" in save)) save.midRun = …
    if (m) coerced.add(m[1]);
  }
  assert.ok(coerced.size >= 8, `the loader's coercions must be findable (found ${coerced.size}: ${[...coerced].join(", ")})`);
  for (const field of coerced) {
    assert.ok(new RegExp("\\b" + field + ":").test(fresh),
      `save.${field} is coerced at boot, so freshSave() must reset it — a reset path that misses a persisted ` +
      "field leaves it undefined, which is exactly how save.ach and save.stars each crashed a win");
  }
  for (const d of ["casual", "normal", "heroic"]) {
    assert.ok(new RegExp(d + ": \\{\\}").test(fresh), `freshSave() must clear the ${d} star ladder`);
  }
  // The gate itself: only the exact word clears anything, and the dialog never
  // touches storage — it calls the owner.
  const tdu = read("scripts/td-ui.js");
  assert.match(tdu, /UI\.showResetGate = function/, "the fort ships a type-the-word reset gate");
  assert.match(tdu, /=== "reset"/, "only the exact word 'reset' confirms");
  assert.ok(!/showResetGate[\s\S]{0,1200}localStorage/.test(tdu), "the reset dialog never writes storage itself");
  assert.match(tdu, /class="td-reset-open" type="button" data-adult="1"/,
    "the reset control is data-adult (small on purpose — the word gate is the lock, not the size)");
  // ONE toast implementation, and it mounts on the screen that is actually visible.
  assert.match(tdu, /UI\.notice = function/, "there is one toast implementation");
  assert.match(tdu, /UI\.toast = function \(icon, name\) \{ return UI\.notice\(/, "the badge toast delegates to it");
  // The visible-screen rule now lives in ONE chooser shared by the toast AND
  // every overlay (see the hostScreen guardrail below) — the toast just uses it.
  assert.match(tdu, /const host = hostScreen\(\);/, "a toast mounts on the VISIBLE screen (a fort-home toast must be seen)");
});

// RULE 7 — an overlay parked on a HIDDEN screen is itself hidden. The guide,
// opened from the defeat overlay on the play screen, rendered as nothing until
// every overlay host went through one visible-screen chooser (the same class as
// the toast that hard-coded #screen-td-play).
test("guardrail: every fort overlay mounts on the VISIBLE screen, via one chooser", () => {
  const tdu = read("scripts/td-ui.js");
  assert.match(tdu, /function hostScreen\(\)/, "there is ONE host chooser");
  assert.match(tdu, /if \(play && !play\.hidden\) return play;/, "it prefers the play screen only when it is visible");
  assert.ok(!/doc\.getElementById\("screen-td-play"\)\.appendChild\(el\)/.test(tdu),
    "no overlay may hard-code the play screen as its host");
  assert.ok(!/doc\.getElementById\("screen-td-home"\)\.appendChild\(el\)/.test(tdu),
    "no overlay may hard-code the home screen as its host");
  const css = read("styles/td.css");
  assert.match(css, /#screen-td-play, #screen-td-home \{ position: relative; \}/,
    "both hosts are positioning contexts, or an absolutely-positioned overlay escapes them");
  // The guide is DERIVED from engine data, never a hand-written table that could drift.
  assert.match(tdu, /L\.reachedBy\(d\)/, "the guide reads reachedBy from the engine");
  assert.match(tdu, /L\.enemyTraits\(d\)/, "…and enemyTraits, so a new enemy explains itself");
  const tdl = read("scripts/td-logic.js");
  assert.match(tdl, /enemyTraits, reachedBy/, "both are exported for the guide AND the tests");
});

// RULE 7 — a new PERSISTED field must be covered at all three sites (loader
// defaults, freshSave, and the two-tab merge). save.ach and save.stars each
// crashed a win by missing one; save.bests is the third instance.
test("guardrail: TD-13 per-level bests are covered by loader, reset and merge", () => {
  const tdm = read("scripts/td-main.js");
  assert.match(tdm, /if \(!save\.bests \|\| typeof save\.bests !== "object"\) save\.bests = \{\};/, "the boot loader coerces save.bests");
  assert.match(tdm, /bests: \{\},/, "freshSave() clears save.bests");
  assert.match(tdm, /if \(other\.bests && typeof other\.bests === "object"\)/, "the two-tab merge folds save.bests");
  assert.match(tdm, /st\.levelId \+ ":" \+ st\.difficulty/, "a best is keyed by level AND difficulty — the ladders are independent");
  // The run tallies live in ENGINE STATE, not the capped event stream.
  const tdl = read("scripts/td-logic.js");
  assert.match(tdl, /dmgBy: \{\}, kills: 0, goldEarned: 0,/, "the run tallies live in state");
  assert.match(tdl, /const HOW_LINE = \{ dart: "dart", splash: "mortar", zap: "fan", melee: "camp"/,
    "one table maps the damage source to its tower line");
  assert.match(tdl, /state\.dmgBy\[src\] = \(state\.dmgBy\[src\] \|\| 0\)/, "attribution happens in the ONE damage path");
  assert.ok(!/cur\.stats\.dmg/.test(tdm), "no parallel event-based damage accounting (only the dart ever emitted a hit event)");
});

// A power the player can't read is a power that doesn't exist. Reported from
// real play: "it's not clear what the powers do".
test("guardrail: every ability names itself on its button and in the guide", () => {
  const data = require("../scripts/td-data.js");
  for (const a of data.ABILITIES) {
    assert.ok(a.short && a.short.length <= 8, `${a.id} needs a SHORT button label (got ${a.short})`);
    assert.ok(a.name && a.role, `${a.id} needs a full name and a role for the guide`);
  }
  const tdu = read("scripts/td-ui.js");
  assert.match(tdu, /td-abil__name">' \+ \(a\.short \|\| a\.name\)/, "the button shows the name, not just an icon and a price");
  assert.match(tdu, /Powers — usable during a wave only/, "the guide has an abilities section");
  assert.match(tdu, /UI\.abilityHint = function/, "there is a hint line for armed/refused taps");
  const tdm = read("scripts/td-main.js");
  assert.match(tdm, /function abilityWhy\(/, "a refusal is explained in plain English");
  for (const reason of ["not-in-wave", "no-targets", "no-soldiers", "no-tower", "cooldown", "gold"]) {
    assert.ok(tdm.includes('"' + reason + '"'), `the refusal "${reason}" has a message`);
  }
  const tdl = read("scripts/td-logic.js");
  assert.match(tdl, /function abilityWouldDo\(/, "a no-op use is detected BEFORE gold or cooldown is spent");
});

// The same defect one layer down, and this one was a TRAP rather than a gap.
// MEASURED 2026-08: the branch buttons showed a name and a price, the guide
// covered lines and powers but not branches, and the only number anywhere was
// the panel's `dps` — which points the WRONG WAY here. Sniper Scope reads 47.3
// dps against the tier-3 dart's 34.3, yet converting every dart to Sniper loses
// L22/L26/L31 outright and 5 of 9 boss finales, because 85 damage a shot is
// overkill against 30 of the 42 non-boss bodies (median hp 34) and its real
// kill rate is a third of the tier-3's. The numbers are NOT the bug — Sniper is
// the anti-tough option and genuinely wins L12/L16 — the silence was.
test("guardrail: a fort control that SPENDS a resource shows the price on its face", () => {
  // Reported from real play: "buying extra gear doesn't specify cost". The ⚙️
  // Toy Energy exchange rendered as "⚙️ 0" with the gold price only in `title`
  // and `aria-label` — and a title is a HOVER affordance, which a touch device
  // does not have. So on the actual phone it was a buy button that never said
  // what it cost. That is the THIRD instance of this class (TD-12's abilities
  // lived only in an aria-label; then ⚙️ itself shipped unnamed), which is why
  // it is a guardrail and not just a fix.
  const ui = read("scripts/td-ui.js");
  assert.ok(/class="td-hud__chargeBuy"/.test(ui),
    "the ⚙️ exchange must have a visible price element, not just a title");
  assert.ok(/buyEl\.textContent\s*=\s*priceable\s*\?\s*price\s*\+\s*"🪙"/.test(ui),
    "…and it must be filled with the LIVE price from the engine");
  // The count and the price are separate nodes: a whole-node textContent write
  // is what forced the price into the title in the first place, because it
  // erased any child added beside the number.
  assert.ok(/querySelector\("\.td-hud__chargeN"\)/.test(ui),
    "the ⚙️ COUNT must be written into its own span, or the price node is erased every frame");
  const css = read("styles/td.css");
  assert.ok(/\.td-hud__chargeBuy\s*\{/.test(css), "the price line needs its own style");
});

test("guardrail: the fort's rapid-tap controls carry BOTH double-tap-zoom defences", () => {
  // Reported from real play: a double-tap on CALL / RUSH and on the ⚙️ buy
  // button zooms the page. `touch-action: manipulation` is declared page-wide,
  // on `.td-screen`, on each control and (now) on their containers — and it
  // intersects down the ancestor chain, so on paper the gesture is already
  // dead. It is a DEVICE-ONLY bug: WebKit is not installed in the dev sandbox,
  // so Chromium can neither prove nor disprove the iOS behaviour. When a layer
  // cannot be verified, it needs a second one working by a different mechanism.
  const css = read("styles/td.css");
  assert.ok(/\.td-controls,\s*\.td-hud,\s*\.td-abils,\s*\.td-bar\s*\{[^}]*touch-action:\s*manipulation/.test(css),
    "the fort's control CONTAINERS must declare touch-action too — the gaps between buttons are where a fumbled second tap lands");
  const ui = read("scripts/td-ui.js");
  assert.ok(/UI\.noDoubleTapZoom\s*=\s*function/.test(ui), "the touchend guard must exist");
  // It is worthless without { passive: false } — preventDefault is ignored in a
  // passive listener, which fails SILENTLY and would leave a guard that looks
  // present and does nothing.
  assert.ok(/addEventListener\("touchend",[\s\S]{0,400}?\{\s*passive:\s*false\s*\}/.test(ui),
    "the touchend guard must be non-passive, or its preventDefault is ignored");
  // …and it must actually be applied to the controls the report named.
  for (const sel of [".td-call", ".td-hud__charge"]) {
    assert.ok(new RegExp("noDoubleTapZoom[\\s\\S]{0,200}" + sel.replace(".", "\\.")).test(ui)
      || new RegExp(sel.replace(".", "\\.") + "[\\s\\S]{0,200}noDoubleTapZoom").test(ui),
      `${sel} must be guarded — it is one of the controls the report named`);
  }
  assert.ok(/UI\.noDoubleTapZoom\(b\)/.test(ui),
    "each ability tile must be guarded as it is built — the strip is rebuilt per run");
});

test("guardrail: every tier-4 branch states its ROLE where it is chosen and in the guide", () => {
  const data = require("../scripts/td-data.js");
  let branches = 0;
  for (const [line, T] of Object.entries(data.TOWERS)) {
    for (const [key, b] of Object.entries(T.branches || {})) {
      branches += 1;
      assert.ok(b.name, `${line}.${key} needs a name`);
      assert.ok(b.role && b.role.length >= 12,
        `${line}.${key} (${b.name}) needs a role line — a 300-gold choice with no explanation is a trap`);
      // The overkill law, derived rather than asserted about one branch: if a
      // SINGLE-TARGET shot lands more damage than MOST non-boss bodies have hp,
      // the role must say so, because paper dps tells the player the opposite.
      // Splash is deliberately exempt and this is not a get-out — the first cut
      // of this law flagged Big Bertha (105 dmg, 34/42 bodies) and that would
      // have been a FALSE warning: a shell applies its damage to every body in
      // the radius, so a big number lands on a clump rather than being thrown
      // away on one. Only a single-target branch can overkill.
      if (b.dmg && !b.splash) {
        const smaller = Object.values(data.ENEMIES).filter((e) => !e.boss && e.hp < b.dmg).length;
        const total = Object.values(data.ENEMIES).filter((e) => !e.boss).length;
        if (smaller / total > 0.6) {
          assert.match(b.role, /wasted|overkill|small bodies/i,
            `${b.name} one-shots ${smaller}/${total} non-boss bodies, so its role must warn about the waste`);
        }
      }
    }
  }
  assert.ok(branches >= 8, `expected the shipped branch set, saw ${branches}`);
  const tdm = read("scripts/td-main.js");
  // The panel DERIVES its branch buttons. This was the only place in the fort
  // that hard-coded "a"/"b" — the engine's branch() has always been generic and
  // the guide already derived — so a line with three ultimates needs no code
  // hunt. Pinned as a derivation rather than a per-key list, because a per-key
  // list is exactly the thing that goes stale.
  assert.match(tdm, /const keys = Object\.keys\(def\.branches \|\| \{\}\)/,
    "the tower panel must DERIVE its branch buttons — a hard-coded a/b is how a shipped branch becomes unreachable");
  assert.match(tdm, /data-b="' \+ k \+ '"/, "…and render one button per key");
  assert.match(tdm, /td-branch__role">' \+ b\.role/, "the branch BUTTON renders its role");
  assert.match(tdm, /b\.name \+ " — " \+ b\.role/, "…and so does its aria-label");
  // The row is sized to the COUNT: a third card left to wrap measured 239 → 350px
  // and fell past the fold at 320x480, 320x568 and landscape 844x390.
  assert.match(tdm, /td-branchrow--' \+ keys\.length/,
    "the branch row must carry its own count, so N cards stay on ONE row");
  const tdu = read("scripts/td-ui.js");
  assert.match(tdu, /const branchRow = \(k\) => Object\.keys\(T\[k\]\.branches/,
    "the guide DERIVES its branch rows from the data, so a ninth branch documents itself");
  assert.match(tdu, /\+ branchRow\(k\)\)\.join\(""\)/, "…and the tower list actually renders them");
  const css = read("styles/td.css");
  assert.match(css, /\.td-branch__role \{[^}]*margin-top/,
    "the role line is spaced with a child margin, never flex gap (Safari 14.0 drops it)");
});

// 🧸 Kid Fort was RETIRED (owner, 2026-08) — it was never used. It is removed
// WHOLE rather than just unhooked: a difficulty nothing can select is the
// dead-feature class this project has already paid for twice (heroic shipped
// with no selector; World 4's levels shipped with no card). This guardrail
// fails if any half of it creeps back — a button with no mode, or a mode with
// no button — and it is the reason `noLose` no longer exists anywhere.
test("guardrail: the retired Kid Fort mode is gone from EVERY layer, not just the button", () => {
  const layers = {
    "scripts/td-ui.js": [/td-kid-open/, /Kid Fort/],
    "scripts/td-main.js": [/kidFort/, /td-kid/, /=== "kid"/],
    "scripts/td-data.js": [/^\s*kid: \{/m],
    "styles/td.css": [/^body\.td-kid/m],
  };
  for (const [file, pats] of Object.entries(layers)) {
    // strip comments — the removal is DOCUMENTED in each file, and a guardrail
    // that matches its own explanation is the recurring self-match trap.
    const src = read(file).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    for (const p of pats) assert.ok(!p.test(src), `${file} still carries kid-mode code (${p})`);
  }
  // The engine's lose site must be unconditional now — no flag may spare a run.
  const tdl = read("scripts/td-logic.js").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  assert.ok(!/noLose/.test(tdl), "the engine must not read a no-lose flag any more");
  const DATA = require("../scripts/td-data.js");
  const diffs = Object.keys(DATA.DIFFICULTIES);
  assert.ok(diffs.length >= 3, "casual/normal/heroic still ship");
  for (const d of diffs) assert.ok(!DATA.DIFFICULTIES[d].noLose, `${d} must be losable — no difficulty may be exempt`);
});

// Haptics + wake lock are BOTH platform-gated. The point of these guardrails is
// that neither may silently pretend to work on a device that doesn't support it.
test("guardrail: haptics and wake lock are feature-checked, never assumed", () => {
  const m = read("scripts/td-main.js");
  // Vibration: Safari on iOS has never shipped navigator.vibrate, so this MUST be
  // a real capability check, not a call that quietly no-ops (or throws).
  assert.match(m, /typeof global\.navigator\.vibrate !== "function"\) return false/,
    "haptics check for real support (iOS Safari has none)");
  assert.match(m, /prefers-reduced-motion[\s\S]{0,24}return false/,
    "a buzz is motion — respect prefers-reduced-motion");
  assert.match(m, /if \(!CAN_BUZZ \|\| !save\.settings\.sfx\) return;/,
    "haptics obey the same toggle as sound");
  assert.match(m, /function sfx\(kind, arg\) \{\n    buzz\(kind\);/,
    "haptics ride the SAME call site as audio, so a new cue gets both for free");
  // Wake lock: needs Safari 16.4+, so it must degrade silently on the iOS 14.2 floor.
  assert.match(m, /if \(!global\.navigator \|\| !global\.navigator\.wakeLock\b/,
    "wake lock is feature-checked (a clean no-op below iOS 16.4)");
  assert.match(m, /doc\.addEventListener\("visibilitychange"/,
    "the lock is re-acquired when the tab returns — the browser drops it on background");
  assert.match(m, /function letSleep\(\)/, "…and released when the battle stops");
  assert.match(m, /function stopLoop\(\)[\s\S]{0,160}letSleep\(\);/, "stopping the loop releases the lock");
  // ONE owner. The first cut acquired in startLevel and released only in
  // stopLoop, so pausing or quitting to the fort mid-run held the lock for ever
  // while you browsed the star tree. keepAwake/letSleep must therefore be
  // reachable ONLY through syncWake(), which reads one predicate.
  assert.match(m, /function wakeWanted\(\)/, "the wake lock has ONE predicate");
  assert.match(m, /function syncWake\(\) \{ if \(wakeWanted\(\)\) keepAwake\(\); else letSleep\(\); \}/,
    "…and ONE owner that applies it");
  const wakeCalls = (m.match(/(?<!function )\b(keepAwake|letSleep)\(\)/g) || []);
  const strayWake = wakeCalls.filter((c) => c === "keepAwake()").length;
  assert.equal(strayWake, 1, `keepAwake() must be called ONLY from syncWake (found ${strayWake})`);
  // Every place that flips `cur.paused` must re-sync the lock within a few lines.
  // Matching the exact surrounding text is brittle (and was: an unrelated edit to
  // the same line broke it) — assert the PROPERTY instead.
  const pausedWrites = [...m.matchAll(/cur\.paused = (?:true|false)/g)];
  assert.ok(pausedWrites.length >= 4, `the pause flag is written in several places (${pausedWrites.length})`);
  for (const w of pausedWrites) {
    const after = m.slice(w.index, w.index + 320);
    assert.match(after, /syncWake\(\)/,
      `every write to cur.paused must re-sync the wake lock — none found after "${m.slice(w.index, w.index + 60).split("\n")[0]}"`);
  }
  // …and the lock's own visibilitychange listener must be the syncWake one (a
  // bare /visibilitychange/ match is satisfied by the unrelated auto-pause listener).
  assert.match(m, /addEventListener\("visibilitychange", syncWake\)/,
    "the wake lock's visibilitychange listener is syncWake itself, not an unrelated one");
  // Every new cue is real: it must exist in sfx() AND be fired from somewhere.
  for (const k of ["ability", "arm", "cleared", "phase", "lowlives", "tier"]) {
    assert.ok(m.includes('kind === "' + k + '"'), `sfx() defines the "${k}" cue`);
    assert.ok(m.includes('sfx("' + k + '")'), `…and something actually fires "${k}" (a cue nothing plays is dead)`);
  }
});

test("the Sticker Book's DOM has ONE owner — both books build through JoshStickers", () => {
  // Josh's 200-slot book and 华丽's 40-slot book built the same three meter
  // elements and the same slot structure from scratch, ~50 duplicated lines
  // apart in main.js and hl-main.js. They are not free to drift: the shared
  // CSS, the live `josh-won` plop, the `[data-sticker]` lookup and the `is-won`
  // replay all assume ONE structure — so a fix to either would have to be made
  // twice, which is the shape of every "two owners" bug this repo has recorded
  // (josh-won-* had three writers; the fort's save reset had two).
  const st = read("scripts/stickers.js");
  assert.match(st, /function meter\(\)/, "JoshStickers owns the star meter");
  assert.match(st, /function slot\(def, art, opts\)/, "…and the slot");
  assert.match(st, /global\.JoshStickers = \{ artFor, meter, slot \}/, "…and exports both");
  for (const f of ["scripts/main.js", "scripts/hl-main.js"]) {
    const src = read(f);
    assert.ok(/ST\.meter\(\)/.test(src), `${f} must build its meter through JoshStickers.meter()`);
    assert.ok(/ST\.slot\(def,/.test(src), `${f} must build its slots through JoshStickers.slot()`);
    // …and must not hand-roll them any more.
    assert.ok(!/className = "sticker-meter"/.test(src),
      `${f} still builds a sticker-meter by hand — JoshStickers.meter() is the one owner`);
    assert.ok(!/className = "sticker-slot tap"/.test(src),
      `${f} still builds a sticker-slot by hand — JoshStickers.slot() is the one owner`);
  }
});

// ---------------------------------------------------------------------------
// 🏰 The fort's COLOUR law: inside a world's own enemy pool, two bodies of
// comparable SIZE must not share a colour.
//
// The roster shipped as a steel monoculture — Plastic Knight, Battery Bot,
// Loose Screw, Tin Plane, Bolt Bucket and Boom Box were all the same pale
// blue-grey, and `#dfe6f0` was the LITERAL same hex in two of them. Measured
// per world against each world's actual wave pool: every one of the eight had a
// colliding pair, garage `cog`/`bucket` and `bucket`/`battery` at exactly 0.0,
// `knight`/`battery` 2.2 in six worlds, `screw`/`tinplane` 3.2 in five. That
// matters for play, not just looks: the Knight is ARMORED, the Tin Plane FLIES,
// the Screw JAMS a gun and the Slime REGROWS while slowed — the Toybox Guide
// tells you to answer each of them differently, and they looked identical.
//
// Three properties make this measurable from SOURCE, which is why it is here and
// not in the browser suite: no rasteriser, no floor, no shared ink rim, no
// antialiased blend, no sprite-size confound. An earlier rendered-pixel attempt
// hit all four and wrongly reported the finding as not reproducing.
//
// The size exemption is DERIVED, not a hand list: a boss draws at 1.8-3.1x
// scale, so its silhouette separates it from a small body regardless of hue.
test("guardrail: no two same-size enemies in a world's pool share a body colour", () => {
  const DATA = require(path.join(root, "scripts/td-data.js"));
  const src = read("scripts/td-render.js");
  const chain = src.slice(src.indexOf("function drawEnemy("));
  const blocks = {};
  // truncate each branch at the next `} else`, or the LAST one runs to the end
  // of the file and picks up the tower drawing
  for (const part of chain.split('} else if (e.type === "').slice(1)) {
    blocks[part.slice(0, part.indexOf('"'))] = part.split(/\n {6}\} else/)[0];
  }
  const firstBranch = chain.split('if (e.type === "balloon") {')[1];
  if (firstBranch) blocks.balloon = firstBranch.split(/\n {6}\} else/)[0];

  const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const luma = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  // BODY colours = the first two light-enough literals in the branch (the
  // gradient stops / main fills). The near-black outline every sprite shares is
  // excluded for the same reason the ink rim had to be.
  const body = {};
  for (const [t, b] of Object.entries(blocks)) {
    const cols = [...new Set(b.match(/#[0-9a-fA-F]{6}/g) || [])].map(hex).filter((c) => luma(c) > 60);
    if (cols.length) body[t] = cols.slice(0, 2);
  }
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const near = (a, b) => Math.min(...a.flatMap((x) => b.map((y) => dist(x, y))));
  const FLOOR = 20;
  const big = (t) => { const d = DATA.ENEMIES[t] || {}; return !!d.boss || (d.size || 1) >= 1.5; };

  const bad = [];
  for (const w of Object.keys(DATA.WORLDS)) {
    const pool = new Set();
    for (const l of DATA.LEVELS.filter((x) => x.world === w)) {
      for (const wv of l.waves) for (const g of wv.groups) pool.add(g.type);
    }
    const ts = [...pool].filter((t) => body[t]);
    assert.ok(ts.length >= 4, `${w}'s pool is readable from the renderer (${ts.length} sprites)`);
    for (let i = 0; i < ts.length; i++) for (let j = i + 1; j < ts.length; j++) {
      if (big(ts[i]) || big(ts[j])) continue;   // scale separates them
      const d = near(body[ts[i]], body[ts[j]]);
      if (d < FLOOR) bad.push(`${w}: ${ts[i]}/${ts[j]} ${d.toFixed(1)}`);
    }
  }
  assert.deepEqual(bad, [],
    "these same-size enemies share a world's pool AND a body colour, so a player cannot tell " +
    "which counter to reach for: " + bad.join(", "));
});

// ---------------------------------------------------------------------------
// GUARDRAIL — ONE LIGHT for Josh's SVG art, shared safely.
//
// The art shipped entirely FLAT (371 lines, zero gradients), so a head, a cube
// and a balloon were all the same solid disc of colour. It is lit now, and the
// whole design turns on a defect this repo already hit once: `stickers.js`
// records a first attempt that gave each sticker its OWN <defs><radialGradient
// id="bg">, which collapsed onto the first sticker's gradient because SVG
// fragment ids resolve DOCUMENT-WIDE and the Sticker Book paints 200 pictures
// into one page. Sharing ONE definition is the escape — and it is only correct
// because the gradients are ALPHA-ONLY. These checks pin every part of that.
// ---------------------------------------------------------------------------
test("ONE LIGHT: Josh's art shares three alpha-only gradients, and cannot re-open the collapse", () => {
  const html = read("index.html");
  const art = read("scripts/art.js");
  // Strip HTML comments FIRST: this block is heavily commented and a comment
  // that merely mentions an id must not be able to satisfy the check.
  const live = html.replace(/<!--[\s\S]*?-->/g, "");
  const block = /<svg class="jart-defs"[\s\S]*?<\/svg>/.exec(live);
  assert.ok(block, "index.html declares the ONE shared shading block (.jart-defs)");

  const declared = [...block[0].matchAll(/<(?:linear|radial)Gradient id="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(declared.slice().sort(), ["jart-dome", "jart-ground", "jart-lit"],
    "exactly the three shared gradients, by stable id");
  assert.equal((live.match(/<(?:linear|radial)Gradient/g) || []).length, declared.length,
    "and NO gradient is declared anywhere else in the page — a second block re-opens the id collapse");

  // ALPHA-ONLY is the whole reason one definition can serve 240 differently
  // coloured pictures. A gradient carrying a colour of its own would tint every
  // one of them the same, which is exactly the collapse in another costume.
  for (const m of block[0].matchAll(/stop-color="([^"]+)"/g)) {
    assert.ok(/^#(?:ffffff|000000)$/.test(m[1]),
      `a shared stop must be pure white or pure black (alpha-only), got ${m[1]}`);
  }
  for (const m of block[0].matchAll(/<stop\b[^>]*>/g)) {
    assert.ok(/stop-opacity="/.test(m[0]), `every shared stop declares its opacity: ${m[0]}`);
  }

  // The art may reference the shared block; it may never declare its own.
  // Comments are stripped for the same reason the HTML's were: art.js DOCUMENTS
  // this rule at length, and a scan that matches its own prose passes (or here,
  // fails) for a reason it never claimed.
  const code = art.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  for (const bad of ["<defs", "<linearGradient", "<radialGradient"]) {
    assert.ok(!code.includes(bad),
      `scripts/art.js must not emit ${bad} — a per-picture definition is the documented collapse ` +
      "(200 Sticker Book slots, one document, one winning id)");
  }
  // A filter on art rendered by the hundred is the documented WebKit
  // rasterization cliff that once stalled CI for over an hour.
  assert.ok(!/<filter|filter\s*[:=]/.test(code),
    "scripts/art.js must not use a filter — gradients composite, filters rasterize");
});

test("ONE LIGHT: every picture uses it, and a missing block degrades instead of painting black", () => {
  const JoshArt = require("../scripts/art.js");
  const live = read("index.html").replace(/<!--[\s\S]*?-->/g, "");
  const declared = new Set([...live.matchAll(/<(?:linear|radial)Gradient id="([^"]+)"/g)].map((m) => m[1]));

  // Every art kind, driven through its real signature.
  const kinds = {
    hero: JoshArt.hero("#e23636"),
    numberFriend: JoshArt.numberFriend(7, "#5ec8ff"),
    pup: JoshArt.pup("#e23636", { coat: "#e3b781", ears: "pointy", patch: "#fff", cap: "#2b6cff" }),
    truck: JoshArt.truck("#ffb703", { tip: 0.6, load: 4 }),
    star: JoshArt.star("#ffd24d"),
    rocket: JoshArt.rocket("#c77dff"),
    balloon: JoshArt.balloon("#ff5e7e"),
    home: JoshArt.home(),
    kid: JoshArt.kid(),
    friend: JoshArt.friend({ style: "curly" }),
  };
  for (const scene of ["face", "house", "flower", "snowman"]) kinds["fixable:" + scene] = JoshArt.fixable(scene);

  let refs = 0;
  for (const [name, svg] of Object.entries(kinds)) {
    assert.ok(/url\(#jart-/.test(svg),
      `${name} must be lit by the shared light — a new art kind may not ship flat`);
    for (const m of svg.matchAll(/(?:fill|stroke)="url\(#([^)]+)\)([^"]*)"/g)) {
      refs++;
      assert.ok(declared.has(m[1]), `${name} references #${m[1]}, which index.html does not declare`);
      // An unresolved paint server renders BLACK in some engines and nothing in
      // others. The ` none` fallback makes it provably nothing, so if the shared
      // block is ever absent the art degrades to exactly the flat drawing it was
      // — the "a field one short must degrade, not disable" law, in paint.
      assert.equal(m[2].trim(), "none",
        `${name}: every gradient reference needs the ` + "` none` fallback, got \"" + m[0] + '"');
    }
  }
  assert.ok(refs >= 30, `the light must actually be applied widely (saw ${refs} references)`);

  // The Sticker Book paints 200 of these into ONE page, so an art kind that
  // quietly triples its element count is a real cost on WebKit's rasterizer.
  // (Measured at the time of writing: the book went 2860 -> 3340 nodes, +16.8%,
  // with no change in build time.)
  const elems = (s) => (s.match(/<(?!\/)/g) || []).length;
  for (const [name, svg] of Object.entries(kinds)) {
    assert.ok(elems(svg) <= 34, `${name} draws ${elems(svg)} elements; the budget is 34 (x200 in the book)`);
  }
  assert.ok(elems(JoshArt.numberFriend(10)) <= 34, "even a ten stays inside the budget");
});

// ---------------------------------------------------------------------------
// GUARDRAIL — the FLOOR and the PROPS, after a visual vet of all 36 levels.
// ---------------------------------------------------------------------------
test("every world's declared floor pattern has a renderer branch", () => {
  // The bedroom — World 1, the first floor anybody sees — declared `carpet` and
  // NO branch existed, so it rendered as a bare gradient with no texture at all.
  // Exactly the class already documented for the spawn marker's if/else falling
  // through to the bedroom's bed, and invisible to the floor guardrail because
  // that hashes the canvas and the palette alone still differed between worlds.
  const DATA = require("../scripts/td-data.js");
  const src = read("scripts/td-render.js").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  const impl = new Set([...src.matchAll(/pattern === "([a-z]+)"/g)].map((m) => m[1]));
  assert.ok(impl.size >= 5, `the scan must actually find the branches (saw ${impl.size})`);
  const missing = [];
  for (const [name, w] of Object.entries(DATA.WORLDS)) {
    const p = w.floor && w.floor.pattern;
    assert.ok(p, `${name} declares a floor pattern`);
    if (!impl.has(p)) missing.push(`${name}:${p}`);
  }
  assert.deepEqual(missing, [],
    "these worlds declare a floor pattern the renderer does not implement, so their floor " +
    "silently paints untextured: " + missing.join(", "));
});

test("a prop's shading has exactly ONE owner", () => {
  // Every prop used to carry THREE shadows from TWO owners: a flat-alpha,
  // hard-edged ellipse at the call site, plus the cast and contact that the
  // lighting pass later gave drawProp and which was never de-duplicated. The
  // call-site one was drawn in bake space with no counter-rotation, so on a
  // phone it came out as a tall oval BESIDE the prop and the floor read as a
  // row of dark discs. Same shape as every other two-owner bug in this file.
  const src = read("scripts/td-render.js").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  const loop = /for \(const p of global\.TDLogic\.propCells\([\s\S]*?\n {8}\}/.exec(src);
  assert.ok(loop, "found the prop placement loop");
  assert.ok(!/ellipse\(/.test(loop[0]),
    "the prop loop must not draw its own shadow ellipse — drawProp owns a prop's shading");
  // …and drawProp must still actually shade, or the check above passes vacuously.
  const dp = /function drawProp\(([\s\S]*?)\n {4}\}/.exec(src);
  assert.ok(dp && /softEllipse\(/.test(dp[0]),
    "drawProp is the owner, so it must lay the shading down itself");
});

test("SELF-HEAL: fx ageing has ONE un-skippable owner, outside the branchy draw loop", () => {
  // Reported from real play: "some of the bad guys after being killed are stuck
  // on the map — 0 health sprites just persisting there wave after wave."
  //
  // `f.ttl -= 1` used to sit at the BOTTOM of drawScreenFx's draw loop, and the
  // corpse branch draws in the character pass and then `continue`s — so a `pop`
  // never aged, never faded and was never spliced. It draws from a synthetic
  // carrying hp 0 (the reported 0-health sprite), and MAX_POPS of them piled up
  // permanently; once the cap filled, the corpse cue stopped working at all.
  //
  // The browser test proves the corpse expires. This one stops the SHAPE coming
  // back: a lifetime that is decremented inside a loop with early exits is only
  // correct for the branches that happen not to exit, so the next fx kind that
  // needs its own `continue` would silently become immortal too.
  const src = read("scripts/td-render.js").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  const ages = src.match(/\.ttl -= 1/g) || [];
  assert.equal(ages.length, 1, `fx lifetime is decremented in ${ages.length} places — it must have exactly one owner`);
  assert.match(src, /for \(const f of fx\) f\.ttl -= 1;/,
    "ageing must be its own branch-free pass over every fx, never the last line of a loop that can `continue`");
  // …and that pass must sit OUTSIDE the draw loop, or the one-owner claim is vacuous.
  const draw = /function drawScreenFx\(\) \{[\s\S]*?\n {6}for \(const f of fx\) f\.ttl -= 1;/.exec(src);
  assert.ok(draw, "found drawScreenFx and its ageing pass");
  const body = draw[0];
  const loopEnd = body.lastIndexOf("\n      }");
  assert.ok(loopEnd > -1 && loopEnd < body.lastIndexOf("for (const f of fx) f.ttl -= 1;"),
    "the ageing pass must come AFTER the draw loop closes, not inside it");
});

test("the fort UI never re-derives a number the META moves", () => {
  // "ASK THE ENGINE, never re-derive" — the law from the price flash, where the
  // panel showed 110 and 🔧 Handyman charged 99. Two sites still broke it after
  // that fix, both understating the run: the SELL button multiplied by
  // DATA.RULES.sellRefund (♻️ Trade-In pays 90%, so 272 shown / 306 paid), and
  // the out-of-energy hint printed DATA.RULES.chargePerWave (🔋 Spare Battery
  // banks one more). Behaviour is pinned in td-logic/td browser tests; this
  // stops a THIRD site growing its own copy, which is how the first two got in.
  const src = read("scripts/td-main.js").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  for (const rule of ["sellRefund", "chargePerWave"]) {
    // The GUIDE may quote a rule — it explains the mechanic rather than this
    // run — so only td-main (the live play surface) is scanned here.
    // No exemptions: the resume path's legacy-checkpoint default was the last
    // one and it asks the engine too, so an owning run is never handed less
    // than a wave's worth of energy on restore.
    const hits = (src.match(new RegExp("RULES\\." + rule, "g")) || []).length;
    assert.equal(hits, 0,
      `td-main reads RULES.${rule} ${hits} time(s) — a meta node moves it, ` +
      "so the number shown to (or given to) the player must come from the engine");
  }
  assert.match(src, /refundOf\(/, "the sell button must ask the engine for its refund");
  assert.match(src, /chargeGrant\(\)/, "the out-of-energy hint must ask the engine for this run's grant");
});

test("the camp's rally REACH has exactly ONE owner", () => {
  // rally() gates the player's flag and defaultRally() picks the opening one.
  // While they each measured reach for themselves they disagreed — and not
  // subtly: 16 of 501 camp-able pads opened on a flag rally() would refuse, so
  // moving it once lost that posture for good. The behavioural proof lives in
  // `AUDIT: a camp's OPENING rally is a flag position the player may choose
  // again`; this stops a THIRD site growing its own copy of the comparison,
  // which is exactly how `hurriedMult` acquired two writers with two different
  // policies and how the wake lock's acquire and release drifted apart.
  const src = read("scripts/td-logic.js").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  // Count the DATA read, not the identifier: `rallyRange` is a substring of
  // `rallyRangeOK`, so matching the bare name scores the gate's own name three
  // times and the scan reports 5 owners of a value with 2. Same family as the
  // enemy-colour scan re-creating a clash by naming the old hex in a comment.
  const reads = (src.match(/TOWERS\.camp\.rallyRange/g) || []).length;
  assert.equal(reads, 2,
    `the reach may be read only by the gate and the clamp, saw ${reads} reads of TOWERS.camp.rallyRange`);
  // …and both of those must be the gate and the clamp, or the count is vacuous.
  assert.ok(/function rallyRangeOK\([\s\S]{0,220}?rallyRange/.test(src),
    "rallyRangeOK is the gate and must read the reach itself");
  assert.ok(/function rallyClamp\([\s\S]{0,320}?rallyRangeOK\(/.test(src),
    "rallyClamp must ask the SAME gate rather than re-deriving the comparison");
  assert.ok(/function rally\(towerId[\s\S]{0,400}?!rallyRangeOK\(/.test(src),
    "rally() must ask the gate too — it is the site that used to own its own copy");
  assert.ok(/return rallyClamp\(/.test(src),
    "defaultRally must return through the clamp, so its result is always a position rally() accepts");
});

test("CI: the deploy watchdog exists, dispatches the deploy, and CANNOT loop", () => {
  // A push to main sometimes creates NO workflow run at all — twice now
  // (02312d2, aa19e32). The commit lands, GitHub fires nothing, and the live
  // site quietly serves the previous build. The failure mode is SILENCE, so
  // nothing goes red and both instances were caught by a human opening the
  // site. The watchdog turns that into an automatic recovery.
  const wd = read(".github/workflows/deploy-watchdog.yml");

  // it has to fire on its own, and be pokeable by hand for testing
  assert.match(wd, /^ {2}schedule:/m, "the watchdog must run on a schedule — that is the entire point");
  assert.match(wd, /cron: *"[^"]+"/, "…with a real cron expression");
  assert.match(wd, /^ {2}workflow_dispatch:/m, "…and be manually pokeable, or it can never be tested");

  // it cannot dispatch anything without this permission — a silent no-op
  // would look exactly like a watchdog that is working and finding nothing.
  assert.match(wd, /actions: *write/, "dispatching deploy.yml requires actions: write");
  assert.match(wd, /createWorkflowDispatch/, "it must actually dispatch");
  assert.match(wd, /workflow_id: *"deploy\.yml", *ref: *"main"/,
    "it must dispatch the DEPLOY workflow on main, not something else");

  // THE SAFETY PROPERTY. It dispatches only when the head commit has ZERO runs
  // of any kind, so the moment a run exists — including a FAILED one — it stops.
  // Without this a broken deploy would be re-kicked every 30 minutes for ever,
  // which is a worse bug than the one being fixed.
  assert.match(wd, /listWorkflowRuns\(\{[\s\S]{0,200}head_sha: *sha/,
    "it must look for runs of THIS head commit, or it cannot tell a missed deploy from an old one");
  assert.match(wd, /total_count > 0[\s\S]{0,240}?return;/,
    "it must bail out when ANY run already exists — that is what stops a failing deploy being re-kicked for ever");

  // and it must not race a run that is simply still being created
  assert.match(wd, /ageMin < 10[\s\S]{0,200}?return;/,
    "it must ignore a commit younger than ~10 min; a healthy push creates its run within seconds");
});

test("player copy is written for the PLAYER, not for the next engineer", () => {
  // Found by SCREENSHOTTING the new 🎖️ Challenges dialog rather than testing it:
  // its blurb ended "(on casual at least — that was measured, not hoped)", which
  // is a note to a colleague about how the feature was verified. Nothing could
  // catch it, because every test of that dialog asserted DOM structure.
  //
  // This is deliberately a LAW about vocabulary rather than a fuzzy "is this
  // developer-ish" check, which would be a false-positive machine: the words
  // below are this repo's TEST-SUITE vocabulary and have no meaning to someone
  // playing a tower defense game. Methodology belongs in the commit message and
  // CLAUDE.md, where it survives; the dialog should say what the thing DOES.
  //
  // Note what is NOT banned, on purpose: "seed" is real player-facing vocabulary
  // in the Daily card ("same seed all day"), and a chip's own description may
  // legitimately say "beatable". The list is only terms that describe how the
  // code was PROVEN.
  const BANNED = [
    "measured, not hoped", "guardrail", "mutation-proven", "byte-identical",
    "the oracle", "auto-solver", "the sim ", "regression test", "test suite",
  ];
  const UI_FILES = ["scripts/td-ui.js", "scripts/td-main.js", "scripts/hl-main.js", "scripts/main.js"];
  const hits = [];
  for (const f of UI_FILES) {
    const src = require("fs").readFileSync(f, "utf8");
    src.split("\n").forEach((line, i) => {
      const code = line.replace(/^\s*\/\/.*$/, "");        // a scan must not read its own docs
      if (!/["'`]/.test(code)) return;
      for (const b of BANNED) {
        if (code.toLowerCase().includes(b.toLowerCase())) hits.push(`${f}:${i + 1} — "${b}"`);
      }
    });
  }
  assert.deepEqual(hits, [],
    "these are test-suite words in a string that reaches the screen — say what the feature DOES:\n  " + hits.join("\n  "));
});
