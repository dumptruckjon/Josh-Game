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

// DERIVED from the page, never maintained by hand. Half the structural
// guardrails in this file iterate SCRIPTS — the Emoji <=13.0 scan, the VS16
// scan, the canvas-API floor scan, the Math.random ban, the SW precache check
// — so a hand-written list means a new script file escapes ALL of them at
// once, silently, until something ships blank on Josh's iPad. That is this
// repo's most-repeated own goal (the VS16 scan hand-listed nine files and so
// missed td-logic.js; the flex-gap law guarded only main.css; the live-verify
// probe polled only index.html), and the fix is always the same: read the list
// off the artefact. What the page loads IS what ships, so a script removed
// from index.html correctly drops out of every scan with it.
const SCRIPTS = [...read("index.html").matchAll(/<script[^>]+src="([^"?]+)/g)].map((m) => m[1].replace(/^\.\//, ""));
// Every shipped HTML PAGE, derived the same way. A page with an inline
// <script> carries emoji and CSS that no SCRIPTS-derived scan can see.
const PAGES = fs.readdirSync(root).filter((f) => /\.html$/.test(f)).sort();
// The CSS a PAGE actually loads: its inline <style> blocks PLUS every stylesheet
// it links. That is what makes a page-scoped law true for index.html (whose
// rules live in styles/main.css) and for a standalone page (whose rules are
// inline) by ONE mechanism, instead of exempting one of them.
// Every FORT source the page loads. Several one-owner BANS below counted a
// needle across a hand-typed subset of these five — and a ban scoped to some of
// the files it applies to is barely a ban: it is meaningless in the files it
// never reads. Note the distinction from a CONDITIONAL law (the inner-scroller
// check), which is only worth widening where its subject is actually present: a
// ban is worth widening precisely to the files where the banned thing does NOT
// yet exist, because that is the whole point of banning it.
const TD_SOURCES = SCRIPTS.filter((f) => /^scripts\/td-/.test(f)).sort();

const pageCss = (f) => {
  const src = fs.readFileSync(path.join(root, f), "utf8");
  let css = [...src.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join("\n");
  for (const m of src.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"?]+)/g)) {
    const abs = path.join(root, m[1]);
    if (fs.existsSync(abs)) css += "\n" + fs.readFileSync(abs, "utf8");
  }
  return css;
};
// Every CSS source the app ships, kept PER FILE. Two laws below are per-file
// properties ("nothing in THAT file turns this off"), so they must NOT use
// pageCss(), which concatenates a page with the sheets it links and would let a
// keyframe in one file be gated by another. One owner, because two copies of
// "what CSS ships" is exactly how a scope goes stale in one of them.
const SHEETS = [
  ["styles/main.css", read("styles/main.css")],
  ["styles/td.css", read("styles/td.css")],
  ...PAGES.map((f) => [f, [...read(f).matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join("\n")]),
];

// "Does this rule set a gap?" is asked by THREE separate iOS-14.2 laws below,
// and all three asked it with a pattern that structurally cannot match the
// LONGHANDS: `[^-a-z]gap:` excludes the `-` in `row-gap:`. Safari 14 drops
// `row-gap` / `column-gap` (and the legacy `grid-gap`) inside a FLEX container
// exactly as it drops the shorthand, so a rule written either of those ways
// ships green and is silently dropped on the one device that matters — the
// same defect that left "Two Words Make One" unable to glue anything, one
// property name over. Measured: ZERO shipped rules use a longhand today, so
// this is coverage rather than a fix. It is ONE owner because it was three
// copies that had to agree, and because a fourth law should inherit it.
const GAP_DECL = /(^|[^-a-z])(grid-)?((row|column)-)?gap\s*:/;

test("the script list is DERIVED from index.html, and is not empty", () => {
  // Guards the derivation itself: a regex that stops matching would silently
  // make every scan above it vacuous, which is worse than the hand list it
  // replaced because it fails OPEN and looks green.
  assert.ok(SCRIPTS.length >= 20,
    `only ${SCRIPTS.length} scripts found in index.html — every scan that iterates SCRIPTS would be near-vacuous`);
  assert.equal(new Set(SCRIPTS).size, SCRIPTS.length, "a script is loaded twice");
  for (const s of SCRIPTS) {
    assert.match(s, /^scripts\/[\w-]+\.js$/, `"${s}" does not look like a script path — the regex is picking up something else`);
  }
});

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
  // PARSE the CORE array — do not substring the file. A whole-file match is
  // satisfied by a COMMENT, and sw.js's own offline-fallback comment quotes
  // "./scripts/main.js" while explaining the precache, so the launcher could
  // drop out of CORE entirely and this test would still pass. Offline that is
  // the documented dead shell: the versioned request misses, falls through to
  // the index.html fallback, and the browser parses HTML as JavaScript.
  const coreBlock = sw.match(/const CORE = \[([\s\S]*?)\n\];/);
  assert.ok(coreBlock, "sw.js must declare a CORE precache array");
  const core = [...coreBlock[1].matchAll(/"([^"]+)"/g)].map((m) => m[1].replace(/^\.\//, ""));
  assert.ok(core.length >= 20, `CORE parsed as only ${core.length} entries — this check would be near-vacuous`);
  // DERIVE the required set from the page, not from a list. SCRIPTS already comes
  // off `<script src>` for exactly this reason, but the tail beside it was typed
  // by hand — two stylesheets and index.html — so a THIRD stylesheet, or the
  // manifest, or a new linked asset would escape the check that exists to stop
  // the app booting as a dead shell offline. Every same-origin thing the page
  // links must be precached; measured at 30 entries with none missing, so this
  // is a tightening of a passing check rather than a newly-blocked build.
  const linked = new Set([...read("index.html").matchAll(/(?:href|src)="(?!https?:|#|data:|\/\/)([^"?]+)/g)]
    .map((m) => m[1].replace(/^\.\//, "")).filter((u) => u && !u.startsWith("#")));
  assert.ok(linked.size >= 25, `the page-asset scan must find the links (saw ${linked.size})`);
  for (const u of [...linked, "index.html"]) {
    assert.ok(core.includes(u), `SW CORE is missing ${u} — offline it 404s to the HTML fallback and the app boots as a dead shell`);
  }
  // …and the derivation must still cover what the hand list covered.
  for (const s of [...SCRIPTS, "styles/main.css", "styles/td.css"]) {
    assert.ok(linked.has(s), `the derived link set lost ${s} — a broken regex here silently empties this whole check`);
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

test("the fort-source population is derived, not typed", () => {
  // TD_SOURCES feeds three one-owner BANS below, so a derivation that narrows
  // makes all three quietly weaker while staying green — the failure mode the
  // animated-background law had to learn twice. Pinned as the population itself
  // rather than a count, because a count cannot separate "narrowed" from "went
  // quiet".
  assert.deepEqual(TD_SOURCES,
    ["scripts/td-data.js", "scripts/td-logic.js", "scripts/td-main.js", "scripts/td-render.js", "scripts/td-ui.js"],
    "every fort script the page loads must be in TD_SOURCES");
});

test("games self-register into the framework registry", () => {
  // The population was a hand-typed ten-file list, and it had TWO holes rather
  // than one. An ELEVENTH games file escapes it outright — and a games file that
  // exists on disk but is never LOADED is invisible to it as well, because the
  // repo-tree walk proves a file is NAMED in CLAUDE.md and never that index.html
  // loads it. So a whole set of games could ship documented, pass every scan and
  // simply never register: dead content, the class already paid for by heroic
  // shipping with no selector and World 4 shipping with no cards. Measured
  // identical today (10 loaded, 10 on disk), so this is COVERAGE, not a fix.
  const loaded = SCRIPTS.filter((f) => /^scripts\/games-.*\.js$/.test(f)).sort();
  const onDisk = fs.readdirSync(path.join(root, "scripts"))
    .filter((f) => /^games-.*\.js$/.test(f)).map((f) => `scripts/${f}`).sort();
  // ONE clause carrying both protections, because the two lists are derived
  // INDEPENDENTLY: a games file the page never loads is dead content, and a
  // derivation that NARROWS can no longer pass by agreeing with a stale literal.
  assert.deepEqual(loaded, onDisk,
    "every scripts/games-*.js must be loaded by index.html, and every games script the page loads must exist on disk");
  // A derivation fails OPEN, and deepEqual([], []) is exactly how both halves
  // break at once — so the floor is a SEPARATE clause from the comparison, for
  // the reason the animated-background law had to learn twice: a count cannot
  // carry two failure modes.
  assert.ok(loaded.length >= 8, `only ${loaded.length} games files found — the scan failed OPEN`);
  for (const f of loaded) {
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
  // RULE 5: no animated full-page background — iOS repaints on scroll and it
  // flashes. Static gradient + small animated elements only.
  //
  // SCOPE, and the confession is in the previous commit's own message: that
  // pass widened three iOS-floor laws to the derived PAGES list and STOPPED AT
  // THREE. This one still read `styles/main.css` alone — one of four CSS
  // sources the app ships — so the fort's stylesheet and every standalone
  // page's inline <style> sat outside it. A page's own body IS the full-page
  // background (Word Cards' sets one), so a shimmering gradient there is
  // precisely the banned defect, on a surface nothing was scanning.
  //
  // …and its PATTERN was part of the scan too: `\bbody\s*\{` cannot see
  // `body.hl-mode{…}`, and every body rule in this app EXCEPT the bare one
  // carries a class (hl-mode / in-game), so the clause was evadable by writing
  // the rule the way the app already writes them. Both holes measured CLEAN on
  // all four sources — coverage, not a fix, which is the honest half.
  assert.match(read("styles/main.css"), /linear-gradient\(/, "should have a gradient background");
  let rootRules = 0;
  for (const [sheet, raw] of SHEETS) {
    if (!raw.trim()) continue;                        // a page with no inline CSS
    const css = raw.replace(/\/\*[\s\S]*?\*\//g, "");
    for (const b of css.match(/@keyframes[^{]+\{(?:[^{}]|\{[^}]*\})*\}/g) || []) {
      assert.ok(!/background/i.test(b),
        `${sheet}: a @keyframes animates 'background' — an animated full-page background repaints on every iOS scroll and flashes`);
    }
    // The full-page surfaces themselves, however the selector is spelled: bare,
    // classed (body.hl-mode), pseudo (body::before) or html.
    for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const isRoot = m[1].split(",").map((one) => one.trim())
        .some((one) => /(^|[\s>+~])(html|body)([.#:\[][^\s>+~]*)?$/.test(one));
      if (!isRoot) continue;
      rootRules += 1;
      // Read the VALUE, because `animation: none` is the reset a reduced-motion
      // block legitimately writes on a body rule and matching the property alone
      // flags correct CSS. A negative lookahead does NOT do this: `\s*(?!none)`
      // is defeated by backtracking — `\s*` gives back the space, the lookahead
      // then sits on " none" rather than "none", and it matches anyway. Its own
      // false-positive control is what caught that, still red after the "fix".
      const anims = [...m[2].matchAll(/(?:^|[;\s{])animation(?:-name)?\s*:([^;}]*)/g)]
        .map((a) => a[1].trim()).filter((v) => v && v !== "none");
      assert.deepEqual(anims, [],
        `${sheet}: "${m[1].trim()}" animates a full-page surface (${anims.join("; ")}) — iOS repaints it on every scroll`);
    }
  }
  // A derivation fails OPEN, and the two failure modes need DIFFERENT clauses —
  // saying which carries which, because a count cannot carry both. The POPULATION
  // clause is the one that catches a narrowed source list: main.css alone has 7
  // root rules and main+td have 8 against a measured 10, so ANY count-based floor
  // near the real value is satisfied by exactly the failure it is meant to catch
  // (proven — dropping PAGES from SHEETS sailed through a `>= 8` floor). The
  // count clause carries the other one: the rule-matching regex going quiet.
  assert.deepEqual(SHEETS.map((x) => x[0]), ["styles/main.css", "styles/td.css", ...PAGES],
    "the CSS-source population must be every stylesheet AND every shipped page");
  assert.ok(rootRules >= 8, `only ${rootRules} html/body rules were audited — the rule scan failed OPEN`);
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
  //
  // SCOPE: this reads SHEETS, not the two stylesheets it was written against —
  // a page's own inline <style> is a stylesheet nothing was scanning, and Word
  // Cards HAS an inner scroller (#menu), so the law's subject is genuinely
  // present rather than hypothetical. That is the test the animated-background
  // widening had to pass, and it is why FIVE sibling clauses in this file were
  // measured and deliberately LEFT at main+td: the dvh-twin and `inset:` laws
  // are already covered for pages by "every shipped PAGE obeys the iOS 14.2
  // floors" (a near-duplicate is noise, not coverage), while the bulk-art
  // `filter` ban is keyed on Josh-world class names, the modal-scrim check
  // needs a modal z-index no page sets, and no page has an absolutely-
  // positioned pseudo — so widening any of those adds a clause that cannot
  // fail. Measured clean here too, so this one is coverage, not a fix.
  let scrollers = 0;
  for (const [file, raw] of SHEETS) {
    const body = raw.replace(/\/\*[\s\S]*?\*\//g, "");
    for (const rule of body.split("}")) {
      const parts = rule.split("{");
      if (parts.length < 2) continue;
      const sel = parts[0], decls = parts[1] || "";
      if (!/overflow-y:\s*(auto|scroll)/.test(decls)) continue;
      scrollers += 1;
      assert.match(decls, /overscroll-behavior:\s*contain/,
        `${file}: "${sel.trim()}" scrolls internally, so it must also declare overscroll-behavior: contain — otherwise scrolling to its end drags the page behind it`);
    }
  }
  // This law is CONDITIONAL ("if a scroller exists…"), so it fails OPEN: a
  // regex that stops matching leaves it green with nothing checked. 4 today
  // (.buddyc__box, both .td-overlay__box variants, #menu), so the floor
  // separates working from silent without sitting on the value.
  assert.ok(scrollers >= 3, `only ${scrollers} inner scrollers found — the scan failed OPEN`);
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
  // …and SIXTH: a page's INLINE <style> is a stylesheet nothing was scanning
  // either. The population is the module-level SHEETS owner, which keeps each
  // source PER FILE for the reason stated there — this law is a per-file
  // property ("nothing in THAT file's reduced-motion block turns it off"), so
  // pageCss() would let a keyframe in one file be gated by another.
  let kfChecked = 0;
  // Collect the CONTENTS of every reduced-motion at-rule, not a slice from the
  // first one. main.css keeps a single block at the end, so slicing worked
  // there by luck; td.css puts an off switch inline beside each animation, so
  // a slice-to-end swallows the rest of the file and matches the animation's
  // OWN normal rule — the check then cannot fail. (Proven: deleting
  // td-toastpop's off switch left the slice version green.)
  const reducedBlocks = (css) => {
    let out = "";
    // WHITESPACE-TOLERANT, not a literal. `prefers-reduced-motion:reduce` with
    // no space is valid CSS and the literal needle could not see it — so the
    // law reported "nothing turns it off" about a page that gates correctly.
    // Found by widening the scope; a scan's own PATTERN is part of the scan.
    const needle = /@media\s*\(\s*prefers-reduced-motion\s*:\s*reduce\s*\)/g;
    let hit;
    while ((hit = needle.exec(css))) {
      const i = hit.index;
      const open = css.indexOf("{", i);
      if (open < 0) break;
      let depth = 0, j = open;
      for (; j < css.length; j++) {
        if (css[j] === "{") depth++;
        else if (css[j] === "}") { depth--; if (!depth) break; }
      }
      out += css.slice(open, j) + "\n";
      needle.lastIndex = j;
    }
    return out;
  };
  for (const [sheet, css] of SHEETS) {
    if (!css.trim()) continue;                          // a page with no inline CSS
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
  assert.ok(kfChecked >= 30, `only ${kfChecked} animated keyframes were checked across ${SHEETS.map((x) => x[0]).join(" + ")}`);
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
  // Sliced on the SECTION MARKERS, not on prose. This used to bound the region
  // with two sentences from the copy, so a wording edit silently made both
  // indexOf calls -1 and the region the empty string — a region bound must be
  // asserted to BE a region, and now it is one the contents row also derives
  // from, which cannot drift with a copy edit.
  const from = ui.indexOf('sec("🎒 Powers")'), to = ui.indexOf('sec("▶ Waves")');
  assert.ok(from >= 0 && to > from, "the scan must find the Powers section to slice");
  const guide = ui.slice(from, to);
  assert.ok(guide.length > 200, `…and a real region, not an empty slice (${guide.length} chars)`);
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
  // Derived, for the same reason Josh's ten-file list was: a THIRD games-hl-*.js
  // escapes a hand-typed pair entirely, and this law is what makes her games
  // register with the hl/zh flags that keep them out of his menus and book.
  // Both directions, so a file on disk the page never loads is caught too.
  const hlLoaded = SCRIPTS.filter((f) => /^scripts\/games-hl-.*\.js$/.test(f)).sort();
  const hlDisk = fs.readdirSync(path.join(root, "scripts"))
    .filter((f) => /^games-hl-.*\.js$/.test(f)).map((f) => `scripts/${f}`).sort();
  assert.deepEqual(hlLoaded, hlDisk,
    "every scripts/games-hl-*.js must be loaded by index.html, and vice versa");
  assert.ok(hlLoaded.length >= 2, `only ${hlLoaded.length} 华丽 games files found — the scan failed OPEN`);
  for (const f of hlLoaded) {
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
  [0x1FAC3, 0x1FACF], // pregnant man/person, person with crown (14.0/15.0), moose + donkey (15.0)
  //   ^ was [0x1FAC3, 0x1FAC6]: the table jumped straight to 0x1FAD7, so 🫎 U+1FACE and
  //   🫏 U+1FACF fell through the gap. Everything below 0x1FAD7 that IS Emoji 13.0 —
  //   🫐 blueberries, 🫒 olive, 🫓 flatbread, 🫔 tamale, 🫕 fondue, 🫖 teapot — sits at
  //   0x1FAD0-0x1FAD6 and stays allowed.
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
  for (const f of [...SCRIPTS, ...PAGES]) {
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
// RULE 5 says "-webkit- prefixes where Safari needs them", and this app already
// prefixes NINE properties. clip-path was the tenth kind and carried none — on
// six declarations that ARE two games' mechanics: `.curtain__who`'s graded
// 100/68/42/0 reveal IS the puzzle of Who's Behind the Curtain?, and
// `.fix__glyph` shows each card's clipped HALF of a toy in Fix the Toys. Both
// are proven to depend on it next door in e2e.test.js (clip-path affects HIT
// TESTING, so it needs no image decoding: with the clip, no point in the
// curtain's box hits it; without, every point does).
//
// The law is DERIVED and is a CONSISTENCY one, which is the only honest form
// available here — this sandbox cannot run Safari 14, so "does that engine need
// the prefix for property X" is not a question it can answer. What it CAN say
// is that a property this app prefixes SOMEWHERE must carry the twin
// EVERYWHERE, and that is falsifiable, needs no version table, and grows by
// itself: adding the first `-webkit-clip-path` is what puts clip-path under the
// law for good. It found exactly one violation when written — `.hl-fumark` set
// `user-select` bare, saved only by the root rule's `-webkit-user-select`
// inheriting.
test("guardrail: a property this app prefixes SOMEWHERE carries its -webkit- twin EVERYWHERE", () => {
  const rules = [];
  for (const [file, raw] of SHEETS) {
    for (const m of raw.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      rules.push([file, m[1].trim().replace(/\s+/g, " "), m[2]]);
    }
  }
  const prefixed = new Set();
  for (const [, , decls] of rules) for (const m of decls.matchAll(/-webkit-([a-z-]+)\s*:/g)) prefixed.add(m[1]);
  // A derivation fails OPEN: an empty set would make every clause below vacuous.
  assert.ok(prefixed.size >= 8 && prefixed.has("clip-path") && prefixed.has("user-select"),
    `only ${prefixed.size} prefixed properties found (${[...prefixed].join(", ")}) — the scan failed OPEN`);
  const bare = [];
  for (const prop of prefixed) {
    const plain = new RegExp("(^|[;{\\s])" + prop + "\\s*:");
    const twin = new RegExp("-webkit-" + prop + "\\s*:");
    for (const [file, sel, decls] of rules) {
      if (!plain.test(decls) || twin.test(decls)) continue;
      bare.push(`${file}: "${sel}" sets ${prop} with no -webkit-${prop}`);
    }
  }
  assert.deepEqual(bare, [],
    `this app prefixes these properties elsewhere, so Safari needs the twin here too:\n  ${bare.join("\n  ")}`);
});

test("guardrail: every aspect-ratio cell has a real height fallback (iOS 14.2 has no aspect-ratio)", () => {
  // POPULATION: every stylesheet the app ships, not just main.css. Measured, no
  // other sheet declares aspect-ratio today, so this is coverage — but a fort
  // dialog or a standalone PAGE would have been outside the law that exists for
  // exactly this collapse. (And what this law CANNOT check is that the fallback
  // leaves a TAPPABLE box: a min-height fixes the HEIGHT and can do nothing
  // about the width. `.dig__patch` was 56x84 on Josh's iPad with this green —
  // that half is pinned behaviourally in mobile.test.js by dropping
  // aspect-ratio for real.)
  const offenders = [];
  for (const [file, css] of SHEETS) {
  // Split into rule blocks "selector { decls }".
  const ruleRe = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = ruleRe.exec(css)) !== null) {
    const sel = file + ": " + m[1].trim(), decls = m[2];
    if (!/aspect-ratio\s*:/.test(decls)) continue;
    const minH = /min-height\s*:\s*([^;]+)/.exec(decls);
    const h = /(?:^|;|\s)height\s*:\s*([^;]+)/.exec(decls);
    const val = (x) => x && x[1].trim();
    const isZero = (v) => v && /^0(\D|$)/.test(v); // "0", "0px", "0 !important"
    const hasReal = (val(minH) && !isZero(val(minH))) || (val(h) && !isZero(val(h)) && val(h) !== "auto");
    if (!hasReal) offenders.push(sel);
  }
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
  //
  // THE PREDICATE FIRST, because shipped data cannot falsify it: no rule in the
  // app uses a gap LONGHAND today, so reverting GAP_DECL to the old
  // `[^-a-z]gap:` leaves every clause below green while the law goes blind to
  // `row-gap` / `column-gap` / `grid-gap` — which Safari 14 drops in flex
  // exactly as it drops the shorthand. So the widening is proven on synthetic
  // declarations, the same move the "Two Words Make One" test makes when it
  // forces `gap: normal` to reproduce a platform that is not in the sandbox.
  for (const decl of ["gap: 8px", "gap:8px", "gap : 8px", "row-gap: 8px", "column-gap: 8px",
                      "grid-gap: 8px", "grid-row-gap: 8px", "grid-column-gap: 8px"]) {
    assert.ok(GAP_DECL.test("{" + decl + ";}"), `GAP_DECL misses "${decl}" — iOS 14.2 drops it in flex just like the shorthand`);
    assert.ok(GAP_DECL.test("{color:red;" + decl + ";}"), `GAP_DECL misses "${decl}" mid-rule`);
  }
  for (const decl of ["background: red", "-webkit-column-gap: 8px", "gap-thing: 8px", "grid-template-columns: 1fr"]) {
    assert.ok(!GAP_DECL.test("{" + decl + ";}"), `GAP_DECL fires on "${decl}", which is not a gap declaration`);
  }
  // …and it must have ONE owner: three laws asked this question with three
  // different patterns, which is how two of them stayed blind to `gap : 8px`
  // as well. Derived over every regex literal in this file rather than banning
  // the three spellings that happened to exist (comment-stripped, for the
  // NINTH recorded time — the comment above quotes the pattern it replaced).
  const selfSrc = read("tests/site.test.js").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const literals = selfSrc.match(/\/(?:\\.|\[[^\]]*\]|[^/\n\\])+\/[gimsuy]*/g) || [];
  assert.ok(literals.length >= 100, `only ${literals.length} regex literals found in this file — the one-owner scan failed OPEN`);
  const gapPatterns = literals.filter((r) => /gap(\\s\*)?:/.test(r));
  assert.equal(gapPatterns.length, 1,
    `${gapPatterns.length} regex literals test for a gap declaration (${gapPatterns.join(" | ")}) — GAP_DECL is the one owner, so a second copy can (and did) go blind to a spelling the others catch`);
  assert.ok(selfSrc.split("GAP_DECL").length - 1 >= 4, "the three gap laws must READ the owner, not re-derive it");

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
      if (/display:\s*(inline-)?flex/.test(body) && GAP_DECL.test(body)) {
        assert.ok(allow.has(sel),
          `new flex+gap rule "${sel}" in ${file} — flex-gap is DROPPED on iOS 14.2; use grid (gap works) or child margins for tappable children, or allowlist it if purely decorative`);
      }
    }
  }
  // …and a `gap` on a selector that INHERITS display:flex is the same bug with
  // no `display` to spot it. td.css's `.td-bar--play` carried one: 8px that a
  // modern browser ADDED to the child margins and iOS 14.2 dropped entirely.
  // The clause written for it was fenced to selectors starting `.td-bar`, in ONE
  // stylesheet — and td.css now carries no such rule at all, so that fence guarded
  // an EMPTY population while main.css carried seven of exactly this shape.
  //
  // The inherited display IS derivable without resolving the cascade, because
  // some properties exist under only one of them: flex-direction/flex-wrap/
  // flex-flow are flex-only, and grid-template-*/grid-auto-* are grid-only. Grid
  // gap WORKS on Safari 14, so only the flex ones are dropped — and each of those
  // must be decoration, exactly like the same-rule allowlist above. A rule with
  // NEITHER signal is unanalyzable from the text, so it must declare its display.
  const INHERITED_FLEX_GAP = new Set([
    ".nm__group",   // 3px between the number-friend's cubes, inside ONE .choice
    ".cater__row",  // 2px between the emoji inside one caterpillar card
    ".mt__choice",  // 2px, icon above its abbreviation, inside one .choice
    ".af__bin",     // 4px, bin icon above its label, inside one .choice
    ".tidy__bin",   // 2px, bin icon above its label, inside one .choice
  ]);
  let inherited = 0;
  for (const [file, raw] of SHEETS) {
    for (const m of raw.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const sel = m[1].trim().replace(/\s+/g, " "), body = m[2];
      if (!GAP_DECL.test(body)) continue;
      if (/display\s*:\s*[\w-]+/.test(body)) continue; // declared: handled above
      inherited += 1;
      const isFlex = /flex-(direction|wrap|flow)\s*:/.test(body);
      const isGrid = /grid-(template|auto|area)/.test(body);
      assert.ok(isFlex || isGrid,
        `${file}: "${sel}" sets gap and declares no display, and nothing in it says whether it inherits flex (iOS 14.2 DROPS the gap) or grid (fine) — declare the display`);
      if (isFlex) {
        assert.ok(INHERITED_FLEX_GAP.has(sel),
          `${file}: "${sel}" sets gap and inherits display:flex — iOS 14.2 DROPS it; use child margins, or allowlist it if purely decorative`);
      }
    }
  }
  assert.ok(inherited >= 5, `only ${inherited} gap-without-display rules found — the scan failed OPEN`);
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
  const files = [...PAGES, ...SCRIPTS];
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
  // Parse CORE here too rather than substring the file — same reason as above.
  const coreBlk = sw.match(/const CORE = \[([\s\S]*?)\n\];/);
  assert.ok(coreBlk, "sw.js must declare a CORE precache array");
  const coreParsed = [...coreBlk[1].matchAll(/"([^"]+)"/g)].map((m) => m[1].replace(/^\.\//, ""));
  assert.ok(coreParsed.length >= 20, `CORE parsed as only ${coreParsed.length} entries — near-vacuous`);
  assert.match(sw, /res\.ok && \(isNav \|\| !\/text\\\/html\/i\.test\(ct\)\)/, "SW only runtime-caches trustworthy responses (poisoning fix)");
  assert.match(sw, /isNav \? caches\.match\("\.\/index\.html"\) : undefined/, "index.html falls back for NAVIGATIONS only");
  // PWA icons, DERIVED from the two places that declare them — the manifest and
  // the page — and checked on all three axes that can break an install. This
  // check carried BOTH of the defects this file keeps recording, at once: a
  // hand-written list of four (so a fifth manifest icon escaped it entirely) and
  // a whole-FILE `sw.includes(path)` (so a comment quoting the path satisfies
  // it, exactly the bug already fixed for the script precache above, where the
  // array is parsed). And nothing checked the files EXIST: a manifest naming an
  // icon that is not on disk is an install that fails on the device with the
  // suite green.
  const manifest = JSON.parse(read("manifest.webmanifest"));
  const icons = new Set((manifest.icons || []).map((i) => i.src.replace(/^\.\//, "")));
  for (const m of read("index.html").matchAll(/(?:href|src)="([^"]*assets\/[^"?]+)/g)) icons.add(m[1].replace(/^\.\//, ""));
  assert.ok(icons.size >= 3, `the icon scan must find the declarations (saw ${icons.size})`);
  // NOT an existsSync check: "the manifest's icons are on disk" is already
  // asserted where the manifest is parsed, and a near-duplicate is noise rather
  // than coverage. What is new is the PRECACHE, read off the parsed array.
  for (const icon of icons) {
    assert.ok(coreParsed.includes(icon),
      `PWA icon ${icon} is not in the SW precache, so an offline install has no icon`);
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
test("guardrail: __TD.script must tick and record the way the real loop does", () => {
  // TWO badges were undrivable for the same reason, and neither had anything to
  // do with the game state: __TD.script — how every fort test advances the
  // engine — advances it WITHOUT the side effects the real loop and the real UI
  // perform. 🧊 Ice Age is sampled per FRAME and its sampler lived inline in
  // loop(); 🎯 Pea Purist reads cur.lines, which the build BUTTON writes while
  // e.place() does not. The resume path already carried a comment about the
  // second one, which is the tell that this is a pattern rather than a one-off.
  //
  // Comment-stripped: a one-owner count is an identifier count, and this repo
  // has four recorded cases of a scan counting its own documentation.
  const m = read("scripts/td-main.js").split("\n")
    .map((l) => (/^\s*\/\//.test(l) ? "" : l.replace(/([^:])\/\/.*$/, "$1")))
    .join("\n");

  const defs = (m.match(/function sampleIceAge\(\)/g) || []).length;
  assert.equal(defs, 1, `the Ice Age sampler must be defined exactly once (found ${defs})`);
  // The gate and both guards belong INSIDE the owner. Asserted positively: the
  // first cut asserted that no OTHER site carries a `tick & 7` gate, and that is
  // a false-positive machine — the HUD has its own unrelated ~4Hz throttle
  // written with exactly that idiom, so it flagged working code the first time
  // it ran. Assert what the thing must BE, not what everything else must not be.
  const body = (m.match(/function sampleIceAge\(\)[\s\S]*?\n  \}/) || [""])[0];
  assert.match(body, /& 7\) !== 0\) return;/,
    "the sampler's per-frame gate must live inside it, so a call site cannot forget it");
  assert.match(body, /cur\.sawIce \|\| cur\.engine\.state\.cheated/,
    "…and so must the once-only and honest-run guards, or scripting it would award on a cheated run");

  const calls = (m.match(/(?<!function )\bsampleIceAge\(\)/g) || []).length;
  assert.ok(calls >= 3,
    `the sampler must run from the frame loop AND both scripted tick paths (found ${calls} call sites)`);
  assert.match(m, /for \(let i = 0; i < c\[1\]; i\+\+\) \{ e\.tick\(\); sampleIceAge\(\); \}/,
    "script's [\"tick\", n] must sample every tick, as the frame loop does");
  assert.match(m, /guard\+\+ < cap\) \{ e\.tick\(\); sampleIceAge\(\); \}/,
    "…and so must its untilPhase loop, which is where a whole wave actually runs");

  // …and the other skipped side effect: the line a scripted build used.
  assert.match(m, /if \(c\[0\] === "place"\) \{ const r = e\.place\(c\[1\], c\[2\]\); if \(r && r\.ok && cur\.lines\) cur\.lines\[c\[1\]\] = true; \}/,
    "script's place must record cur.lines like the build button does, or 🎯 Pea Purist can never earn from a scripted run");
});

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
  // The badge path used to be a `UI.toast` wrapper delegating here. `announce()`
  // in td-main owns it now and routes by the run's PHASE — into the outcome box
  // when one is on screen, as a toast otherwise — because a toast paints UNDER an
  // overlay scrim and nearly every badge is earned at a win. The wrapper was
  // deleted as a trap (it bypassed that routing), so what this pins is the
  // PROPERTY it always meant: the badge announcement reaches the one toast
  // implementation rather than growing a second.
  assert.match(read("scripts/td-main.js"), /UI\.notice\(/,
    "the badge announcement goes through the one toast implementation");
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
  // Each tally is asserted on its OWN, not as one literal line: pinning their
  // exact adjacency makes ADDING a tally break a law about where tallies live,
  // which is the whole-object-deepEqual defect in regex form (the reset guardrail
  // learned it the same way when a new setting landed). The claim is that they
  // live in engine state rather than the capped event stream, and a fourth tally
  // does not violate it.
  for (const [field, init] of [["dmgBy", "{}"], ["dmgByPad", "{}"], ["kills", "0"], ["goldEarned", "0"]]) {
    assert.match(tdl, new RegExp(field.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ": " +
      init.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "[,\\s]"),
      `the ${field} run tally must be initialised in engine state`);
  }
  assert.match(tdl, /const HOW_LINE = \{ dart: "dart", splash: "mortar", zap: "fan", melee: "camp"/,
    "one table maps the damage source to its tower line");
  assert.match(tdl, /state\.dmgBy\[src\] = \(state\.dmgBy\[src\] \|\| 0\)/, "attribution happens in the ONE damage path");
  // …and so does the PER-PAD attribution, in the same place, off the same `eff`.
  // Keyed by pad and not by tower id on purpose: a resumed run rebuilds towers
  // through place() and ids come from a counter enemies also consume, so a tally
  // keyed on an id credits the wrong gun after a restore.
  assert.match(tdl, /state\.dmgByPad\[srcId\] = \(state\.dmgByPad\[srcId\] \|\| 0\)/,
    "the per-pad tally is attributed in the ONE damage path too");
  assert.ok(!/dmgByPad\[[a-z]*\.?id\]/.test(tdl),
    "the per-pad tally must never be keyed on a tower id — those are reassigned on resume");
  assert.match(tdl, /delete state\.dmgByPad\[t\.padId\];/,
    "removeTower clears the pad's tally, or the next tower there inherits its work");
  // it rides the checkpoint, like the per-line tally beside it
  assert.match(tdm, /dmgByPad: Object\.assign\(\{\}, st\.dmgByPad\)/, "the checkpoint carries the per-pad tally");
  assert.match(tdm, /if \(mr\.dmgByPad\) e\.state\.dmgByPad = Object\.assign\(\{\}, mr\.dmgByPad\)/,
    "…and the resume restores it");
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
  // the SECTION marker, not a sentence of its copy — the prose is free to change
  assert.match(tdu, /sec\("🎒 Powers"\)/, "the guide has an abilities section");
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
  // COMMENT-STRIPPED, because a one-owner count is an identifier count and the
  // rule is explained in prose right beside the code it governs — so the scan
  // matches its own documentation and reports call sites that are sentences.
  // (The keepAwake count below survived only because its comment happens to
  // write "keepAwake/letSleep" without the parens.) Cuts at `//` unless it is
  // part of a `://`, so a URL in a string cannot swallow a real call.
  const mCode = m.split("\n")
    .map((l) => (/^\s*\/\//.test(l) ? "" : l.replace(/([^:])\/\/.*$/, "$1")))
    .join("\n");
  const strayWake = (mCode.match(/(?<!function )\bkeepAwake\(\)/g) || []).length;
  assert.equal(strayWake, 1, `keepAwake() must be called ONLY from syncWake (found ${strayWake})`);
  // Every place that flips `cur.paused` must re-sync the lock within a few lines.
  // Matching the exact surrounding text is brittle (and was: an unrelated edit to
  // the same line broke it) — assert the PROPERTY instead.
  const pausedWrites = [...m.matchAll(/cur\.paused = (?:true|false)/g)];
  assert.ok(pausedWrites.length >= 4, `the pause flag is written in several places (${pausedWrites.length})`);
  for (const w of pausedWrites) {
    const after = m.slice(w.index, w.index + 320);
    assert.match(after, /syncRun\(\)/,
      `every write to cur.paused must re-sync the run — none found after "${m.slice(w.index, w.index + 60).split("\n")[0]}"`);
  }
  // …and the lock's own visibilitychange listener must be the composed one (a
  // bare /visibilitychange/ match is satisfied by the unrelated auto-pause listener).
  assert.match(m, /addEventListener\("visibilitychange", syncRun\)/,
    "the run's visibilitychange listener is syncRun itself, not an unrelated one");

  // THE SOUNDTRACK NEEDS THE SAME THING, and shipped with none of it: it was
  // started in startLevel and stopped only in stopLoop, so backgrounding the
  // tab left the loop scheduling (throttled to ~1Hz — the march becomes a
  // drone while you are in another app) and quitting to the fort played
  // battle music over the menu. That is the wake lock's own bug, one
  // lifecycle over, so it gets the same shape: one predicate, one owner.
  assert.match(m, /function musicWanted\(\)/, "the soundtrack has ONE predicate");
  assert.match(m, /function syncMusic\(\) \{ if \(musicWanted\(\)\) \{ if \(!musicTimer\) startMusic\(\); \} else stopMusic\(\); \}/,
    "…and ONE owner that applies it — the !musicTimer guard matters, or every pause/resume/route restarts the phrase");
  const strayMusic = (mCode.match(/(?<!function )\bstartMusic\(\)/g) || []).length;
  assert.equal(strayMusic, 1, `startMusic() must be called ONLY from syncMusic (found ${strayMusic})`);
  // The two predicates genuinely disagree about a paused battle (a pause menu
  // sits over a visible field and keeps its music), so they stay separate —
  // but every CALL SITE takes both, or the halves drift exactly as the wake
  // lock's acquire and release once did.
  assert.match(m, /function syncRun\(\) \{ syncWake\(\); syncMusic\(\); \}/,
    "one composed owner, so a future state cannot remember the lock and forget the music");
  const strayWakeOwner = (mCode.match(/(?<!function )\bsyncWake\(\)/g) || []).length;
  assert.equal(strayWakeOwner, 1, `syncWake() must be reached only through syncRun (found ${strayWakeOwner})`);
  // Every cue is real, in BOTH directions. This was a hand-written list of six
  // against a table of twenty-five — so nineteen cues were outside the law,
  // including `buycharge`, the very cue whose absence was the defect it was
  // written for (sfx() is an if/else chain, so a name with no branch falls
  // straight through and plays NOTHING). Derived now, so a new cue inherits it.
  const sfxBody = (() => {
    const i = mCode.indexOf("function sfx(kind, arg)");
    const j = mCode.indexOf("\n  function ", i + 10);
    assert.ok(i > 0 && j > i, "the sfx() body is one region");   // a bad slice must not pass vacuously
    return mCode.slice(i, j);
  })();
  const cueDefined = new Set([...sfxBody.matchAll(/kind === "([a-z-]+)"/g)].map((x) => x[1]));
  const cueFired = new Set();
  for (const call of mCode.matchAll(/\bsfx\(([^)]*)\)/g)) {
    // A cue can be raised through a ternary — sfx(e.shielded ? "shielded" : "leak")
    // — so a first-argument-literal scan would report two LIVE cues as dead. And
    // a comparison operand is not a cue: sfx(id === "drop" ? "splash" : "build")
    // must not offer up "drop".
    const cleaned = call[1].replace(/[!=]==?\s*"[^"]*"/g, "");
    for (const lit of cleaned.matchAll(/"([a-z-]+)"/g)) cueFired.add(lit[1]);
  }
  assert.ok(cueDefined.size >= 20, `the cue table was found (saw ${cueDefined.size})`);
  for (const k of cueFired) {
    assert.ok(cueDefined.has(k),
      `sfx("${k}") has no branch in the cue table — an if/else chain falls through and plays NOTHING`);
  }
  for (const k of cueDefined) {
    assert.ok(cueFired.has(k), `nothing fires the "${k}" cue (a cue nothing plays is dead)`);
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
  }
  // …and the hand-roll BAN runs over every script the page loads, not just the
  // two known books. A ban scoped to its known consumers cannot see a THIRD one
  // — and a third world with a third book is exactly how this app has grown
  // twice. stickers.js is exempt because it IS the owner: it is the one file
  // that must contain these structures.
  for (const f of SCRIPTS.filter((f) => f !== "scripts/stickers.js")) {
    const src = read(f);
    assert.ok(!/className = "sticker-meter"/.test(src),
      `${f} builds a sticker-meter by hand — JoshStickers.meter() is the one owner`);
    assert.ok(!/className = "sticker-slot tap"/.test(src),
      `${f} builds a sticker-slot by hand — JoshStickers.slot() is the one owner`);
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
test("every world's declared floor, road and props have a renderer branch", () => {
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

  // The same law, on the world's other two declared surfaces. `pattern` was the
  // one that bit, but `road` is the field this file records THREE worlds sharing
  // (they had none and fell through to the default wood), and it covers the 19%
  // of the canvas the eye actually tracks for a whole run.
  const styles = new Set([...src.matchAll(/style === "([a-z]+)"/g)].map((m) => m[1]));
  assert.ok(styles.size >= 4, `the road scan must find the branches (saw ${styles.size})`);
  const roadless = [];
  for (const [name, w] of Object.entries(DATA.WORLDS)) {
    const st = w.floor && w.floor.road && w.floor.road.style;
    assert.ok(st, `${name} declares a road style`);
    if (!styles.has(st)) roadless.push(`${name}:${st}`);
  }
  assert.deepEqual(roadless, [],
    "these worlds declare a road style the renderer does not draw, so their lane silently " +
    "falls back to the shared wood: " + roadless.join(", "));

  // And the PROPS, where the failure is not blankness but a wrong picture: the
  // dispatch ends in an `else` that draws a floor STAIN, so a new or mistyped
  // prop name does not vanish — it paints a dark ellipse. On a light floor that
  // reads as a HOLE, which is exactly the defect that took `stain` off World 10.
  // The assertion is deliberately EXACT rather than an allowlist: `stain` is the
  // documented default, and the moment a second prop joins it in the fall-through
  // this goes red instead of quietly widening.
  const kinds = new Set([...src.matchAll(/kind === "([a-z]+)"/g)].map((m) => m[1]));
  const declaredProps = new Set();
  for (const w of Object.values(DATA.WORLDS)) {
    assert.ok((w.floor.props || []).length, "every world declares floor props");
    for (const pr of w.floor.props) declaredProps.add(pr);
  }
  assert.ok(declaredProps.size >= 6, `the prop scan must find the props (saw ${declaredProps.size})`);
  const undrawn = [...declaredProps].filter((pr) => !kinds.has(pr)).sort();
  assert.deepEqual(undrawn, ["stain"],
    "exactly one declared prop may rely on the renderer's default branch (the floor stain). " +
    "Anything else here has no drawing of its own and will silently paint as a dark ellipse — " +
    "a hole in the floor, not a toy: " + undrawn.join(", "));
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
  const strip = (f) => read(f).replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  const src = strip("scripts/td-main.js");
  for (const rule of ["sellRefund", "chargePerWave", "lives", "earlyCallRate"]) {
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
  // BOTH consumers must ask the owner, counted rather than matched once: a
  // named-rule scan is blind to a bare literal, so replacing the danger score's
  // `maxLives() * 0.3` with `20 * 0.3` passes every clause above (proven — that
  // mutation was green until this line existed). A count is not a tuning pin;
  // a third consumer keeps it green, and dropping one is a conscious act.
  const asks = (src.match(/maxLives\(\)/g) || []).length;
  assert.ok(asks >= 2,
    `both the victory screen and the danger score must ask the engine for the run's starting lives — found ${asks} site(s)`);

  // td-ui is scanned for the two rules the GUIDE does not quote. The exemption
  // is per-RULE rather than per-file: the guide explains the ⚙️ energy mechanic
  // and correctly names chargePerWave/chargeMax there, but it says nothing about
  // the early-call rate or the life total, so a read of either is a live
  // surface re-deriving a number the meta moves. Both were: the victory screen
  // printed "24 of 20 stickers kept safe" to an ❤️ Extra Hearts run, and the
  // CALL button's fallback re-derived the bonus from earlyCallRate, which
  // ⏩ Early Bird multiplies by 1.5 — understating an owning run by a third.
  const ui = strip("scripts/td-ui.js");
  for (const rule of ["lives", "earlyCallRate"]) {
    const hits = (ui.match(new RegExp("RULES\\." + rule, "g")) || []).length;
    assert.equal(hits, 0,
      `td-ui reads RULES.${rule} ${hits} time(s) — the guide does not quote it, so this is a live ` +
      "surface re-deriving a number a meta node moves");
  }
});

test("every timed STATE the engine puts on a body has a picture", () => {
  // Enumerating the enemy's own state fields against the renderer is how
  // `brittleUntil` was found: ZERO references in the whole of td-render.js, so
  // ❄️ Blizzard Cone's 300-gold headline ("chilled bodies take extra damage")
  // was a sentence on a card and nothing on the field — the exact sibling of the
  // defect 🎯 Rust Ray's own cue was written for, left unwritten. `hurriedUntil`
  // was the same, and worse: three mechanics write it, one of them 🎁 The Big
  // Present, whose entire design is that it never hits you and makes the party
  // arrive FASTER, so the campaign's finale did its one trick invisibly.
  // `<name>Until` is this engine's own convention for a timed mark, so the
  // population DERIVES and a twelfth state inherits the rule.
  const logic = read("scripts/td-logic.js").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  const render = read("scripts/td-render.js").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  const fields = [...new Set(logic.match(/\b[a-zA-Z]+Until\b/g) || [])].sort();
  // Each exemption NAMES the picture that already exists, because "it has no
  // mark" and "its mark is somewhere else" are different things and only the
  // second is allowed. Both were verified by reading the code, not assumed.
  const DRAWN_ELSEWHERE = {
    leverUntil: "the thrown route is lit along the lane and the button reads SHORT WAY / LONG WAY",
    stunnedUntil: "only ever set while blockedBy a soldier, so the RC car is drawn on top of it, " +
      "and the engine emits a `stun` event the renderer already bursts as stars",
  };
  assert.ok(fields.length >= 8,
    `the state-field scan must find the marks (saw ${fields.length}) — a derivation fails OPEN`);
  const blind = fields.filter((f) => !DRAWN_ELSEWHERE[f] && !render.includes(f));
  assert.deepEqual(blind, [],
    "a timed state with no renderer reference is a mechanic the player cannot see: " + blind.join(", "));
  // …and an exemption may not outlive the field it excuses.
  for (const f of Object.keys(DRAWN_ELSEWHERE)) {
    assert.ok(fields.includes(f), `${f} is exempted here but the engine no longer has it`);
  }
});

test("the wave's bodies-left count is read from the engine ONCE", () => {
  // ONE surface shows it — the field pill — and it stays one call. It was two
  // for a while (the CALL button's meta line repeated it), and that duplicate is
  // gone because it wrapped away from its unit on every phone width; but the
  // pin is worth keeping either way, because the moment a second reader appears
  // it must share this hoisted call. Two calls would be two answers whenever a
  // kill lands between them, the class that gave `hurriedMult` two writers.
  const ui = read("scripts/td-ui.js").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  const calls = (ui.match(/\.bodiesLeft\(\)/g) || []).length;
  assert.equal(calls, 1,
    `td-ui calls bodiesLeft() ${calls} time(s) — the CALL meta and the field pill must share ONE read`);
  // And it must be the ENGINE's quantity, not a recount: most of a fresh wave is
  // still QUEUED rather than on screen, so a UI-side `state.enemies` tally
  // understates it at exactly the moment the player looks. Behaviour is pinned
  // in `QoL: the field says how much of the wave is LEFT`; this stops a future
  // edit quietly swapping the source.
  assert.equal((ui.match(/enemies\.filter\(/g) || []).length, 0,
    "td-ui must not tally live enemies itself — bodiesLeft() counts the spawn queue too");
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

test("guardrail: the Endless lock hint DERIVES its level count", () => {
  // "the 4 levels" was a literal that happened to be right when every world had
  // four — and it still is right for all ten, which is exactly why the browser
  // test cannot catch a regression here: hard-coding 4 passes it. This can.
  const ui = read("scripts/td-ui.js").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const hint = ui.match(/"🔒 3⭐ all " \+ ([^ ]+) \+ " levels"/);
  assert.ok(hint, "the Endless lock hint must still be there, phrased as an instruction");
  assert.ok(!/^\d+$/.test(hint[1]),
    `the level count must be DERIVED, not a literal (saw ${hint[1]}) — every world has four today, so a ` +
    "literal is invisible to the rendered test");
  assert.match(ui, /const n = worldLevels\(w\)\.length/,
    "…and derived from the world's own levels");
});

test("guardrail: \"what is this run called\" has exactly ONE owner", () => {
  // The pause menu and the resume banner both have to name the run, and the
  // banner used to build that sentence inline. Two copies is how they drift —
  // and the drift is not cosmetic here: an endless levelId is a STRING that is
  // NOT in DATA.LEVELS, so a second copy that forgets the endless branch throws
  // exactly where UI.hud once did.
  const ui = read("scripts/td-ui.js").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  assert.equal((ui.match(/UI\.runLabel = function/g) || []).length, 1,
    "runLabel must be defined exactly once");
  assert.ok((ui.match(/UI\.runLabel\(/g) || []).length >= 1,
    "…and actually used inside td-ui (the resume banner)");
  const main = read("scripts/td-main.js").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  assert.match(main, /UI\.runLabel\(/, "…and by the pause menu, which is told where it is");
  // The endless branch is the load-bearing half: without it a string levelId
  // falls through LEVELS.find and the label is built from undefined.
  assert.match(ui, /endless \|\| !lvl/,
    "runLabel must carry the endless predicate UI.hud uses — a generated level is not in DATA.LEVELS");
});

test("guardrail: \"how far into this run\" has exactly ONE owner", () => {
  // runLabel's sibling, and it had the same defect one field over: the HUD held
  // the only formatter — including the load-bearing `endless || !level`
  // predicate — and the resume banner had grown a poorer second copy beside it
  // (`" · wave " + (mr.waveIdx + 1)`: no total, no endless branch).
  //
  // The scan counts the COMPUTATION, not the copy. A word scan is not available
  // here: three other places legitimately format a wave number (the endless
  // 🏆 best, the picker's "Best: wave", the daily's all-time), and they are
  // SCORES, not this run's position — a scan that flagged them would be the
  // false-positive machine this project refuses to ship. `waveIdx + 1` is the
  // 1-based conversion, and only a formatter of the CURRENT position does it.
  const ui = read("scripts/td-ui.js").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  assert.equal((ui.match(/UI\.waveLabel = function/g) || []).length, 1,
    "waveLabel must be defined exactly once");
  const at = ui.indexOf("UI.waveLabel = function");
  const end = ui.indexOf("\n  UI.", at + 10);
  assert.ok(at >= 0 && end > at, "the scan must find a real region to slice, not the rest of the file");
  const body = ui.slice(at, end);
  const all = (ui.match(/waveIdx \+ 1/g) || []).length;
  const mine = (body.match(/waveIdx \+ 1/g) || []).length;
  assert.ok(mine >= 1, "…and it must actually do the 1-based conversion itself");
  assert.equal(all, mine,
    `a wave position is converted to 1-based in ${all} places and ${mine} of them are inside waveLabel — ` +
    "a second formatter is how the endless branch gets forgotten, which is the one that throws");
  // Both surfaces must READ it, or the owner is decorative.
  assert.match(ui, /wave\.textContent = UI\.waveLabel\(/, "the HUD reads the owner");
  assert.match(ui, /UI\.waveLabel\(mr\./, "…and so does the resume banner");
  assert.match(ui, /inf = endless \|\| !level/,
    "waveLabel must carry the endless predicate — a generated level is not in DATA.LEVELS");
});

test("guardrail: the two ways back into a lost level really differ", () => {
  // The defeat screen now SAYS which is which ("the same waves" / "a different
  // roll"), so the words are a claim about behaviour. That 🔁 Try again reuses
  // the seed is driven in the browser; that 🎲 New shuffle does NOT is pinned
  // here, because comparing two clock-derived seeds would be a 1-in-100000
  // flake and this suite has already paid for one of those.
  const main = read("scripts/td-main.js").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  // There are THREE `retry:` handlers (daily, endless, campaign) and only the
  // campaign one is under discussion — an unanchored indexOf finds the daily's,
  // which has no seed at all and fails for the wrong reason. `retrynew:` is
  // unique and sits immediately after the campaign's, so anchor on it and walk
  // back.
  const newAt = main.indexOf("retrynew: () =>");
  assert.ok(newAt > 0, "the campaign defeat must offer a fresh roll");
  const retryAt = main.lastIndexOf("retry: () =>", newAt);
  assert.ok(retryAt > 0 && newAt - retryAt < 400,
    `the campaign retry must sit just before it (gap ${newAt - retryAt})`);
  const line = (at) => main.slice(at, main.indexOf("\n", at));
  const retry = line(retryAt), fresh = line(newAt);
  assert.match(retry, /seed: st\.seed/, "🔁 Try again replays the run's OWN seed");
  assert.ok(!/seed: st\.seed/.test(fresh), "🎲 New shuffle must not reuse it — it would be the same button twice");
  assert.match(fresh, /seed: \(Date\.now\(\)/, "…it rolls a fresh one from the clock");
});

test("guardrail: a tower LINE's icon and name have exactly one owner", () => {
  // What a line looks like and what it is called is player-facing, and it had
  // THREE owners disagreeing on two of four lines: DATA.TOWERS (what the build
  // menu paints), a `LINE` map in the guide, and a `NAME` map in the run
  // summary — the last two both teaching 💥 and ❄️, glyphs that appear nowhere
  // else in the game. A scan is the half that stops a fourth map appearing; the
  // browser test beside it proves the surfaces actually agree.
  const strip = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const data = require("../scripts/td-data.js");
  const ids = Object.keys(data.TOWERS);
  assert.ok(ids.length >= 4, `the arsenal is real (${ids.length})`);
  for (const id of ids) {
    const t = data.TOWERS[id];
    assert.ok(t.icon && t.name && t.short, `${id} declares icon, name and short in the DATA`);
  }
  // No other source file may map a line id to a quoted glyph. Derived from the
  // ids, so a fifth line inherits the ban.
  // Every fort source EXCEPT td-data.js, which is the owner and legitimately
  // holds the glyphs. td-logic.js was outside the old list and is exactly where
  // a second table would land — `reachedBy` returns line KEYS, and the defeat
  // screen's bug was joining those raw, so an author "fixing" that in the engine
  // is the plausible route to a second owner.
  for (const f of TD_SOURCES.filter((f) => f !== "scripts/td-data.js")) {
    const src = strip(read(f));
    for (const id of ids) {
      const re = new RegExp("\\b" + id + "\\s*:\\s*[\"'][^\x00-\x7F]");
      assert.ok(!re.test(src), `${f} maps ${id} to its own glyph — DATA.TOWERS is the owner`);
    }
  }
  // …and the one formatter both surfaces read is defined exactly once.
  const ui = strip(read("scripts/td-ui.js"));
  assert.equal((ui.match(/UI\.lineIcon = function/g) || []).length, 1, "lineIcon is defined once");
  assert.equal((ui.match(/UI\.lineLabel = function/g) || []).length, 1, "lineLabel is defined once");
  assert.match(ui, /TOWERS \|\| \{\}\)\[id\]/, "…and it reads the tower data rather than a table of its own");
  assert.match(strip(read("scripts/td-main.js")), /UI\.lineLabel\(/,
    "the defeat advice and the run summary go through the owner");
});

test("guardrail: a file that declares a shebang is executable", () => {
  // A `#!` line exists for exactly one purpose — to let you run the file
  // directly — so on a non-executable file it is a declaration that does
  // nothing. All eight research tools carried `#!/usr/bin/env node` and mode
  // 644, which is why CLAUDE.md's own `W9=1 tools/td-map-search.js` could not be
  // copy-pasted: it dies with "Permission denied" while the identical command
  // with `node` in front works. The repo's own convention already said so —
  // .claude/resync-main.sh has always been executable — so the tools were the
  // exception, not the rule.
  //
  // DERIVED over every tracked file, so a ninth tool inherits it. It reads the
  // INDEX rather than the working tree, because that is what a fresh clone gets:
  // a local chmod that was never committed would otherwise pass here and fail
  // for everybody else.
  const { execFileSync } = require("node:child_process");
  const rows = execFileSync("git", ["ls-files", "-s"], { encoding: "utf8" }).trim().split("\n");
  const shebang = [];
  for (const row of rows) {
    const m = row.match(/^(\d{6}) \w+ \d+\t(.+)$/);
    if (!m) continue;
    const [, mode, file] = m;
    if (!fs.existsSync(path.join(root, file))) continue;
    let head = "";
    try { head = read(file).slice(0, 2); } catch (e) { continue; }   // binary or unreadable
    if (head === "#!") shebang.push({ file, mode });
  }
  assert.ok(shebang.length >= 9, `the shebang files must be found (saw ${shebang.length})`);
  const notExec = shebang.filter((x) => x.mode !== "100755").map((x) => x.file);
  assert.deepEqual(notExec, [],
    `these declare a shebang and are not executable, so running them directly fails: ${notExec.join(", ")}`);
});

test("guardrail: a world LIST is ordered by the campaign, and the daily's raw order is deliberate", () => {
  // The order the worlds come in is a campaign fact, and it had two owners:
  // DATA.LEVELS and whoever typed the keys of ENDLESS.worlds. They drifted, and
  // the endless picker — which read the keys — listed world 6 above world 5.
  // Only TWO places in the app enumerate the world keys, and they want opposite
  // things, so the exemption has to be conscious rather than accidental.
  const strip = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const logic = strip(read("scripts/td-logic.js"));
  assert.equal((logic.match(/function worldOrder\(/g) || []).length, 1, "worldOrder is defined exactly once");
  assert.match(logic, /worldOrder, byWorldOrder/, "…and both are exported for the shell to read");
  // it must DERIVE from the campaign, not from a list of world names
  const at = logic.indexOf("function worldOrder(");
  const body = logic.slice(at, logic.indexOf("\n  function ", at + 10));
  assert.ok(at >= 0 && body.length > 20 && body.length < 500, "the scan must slice a real region");
  assert.match(body, /DATA\.LEVELS/, "worldOrder reads the campaign itself");

  // 1. anything RENDERING a list of worlds must go through the owner. Counting
  //    `Object.keys(...ENDLESS.worlds)` across the file was the obvious form and
  //    is VACUOUS — the picker enumerates through a local alias, so both sides
  //    of that comparison were 0 and it passed on nothing. Slice the function
  //    and count what IT does instead.
  const ui = strip(read("scripts/td-ui.js"));
  const pAt = ui.indexOf("UI.showEndless = function");
  const pEnd = ui.indexOf("\n  UI.", pAt + 10);
  assert.ok(pAt >= 0 && pEnd > pAt, "the scan must find showEndless to slice, not the rest of the file");
  const pick = ui.slice(pAt, pEnd);
  assert.equal((pick.match(/Object\.keys\(/g) || []).length, 1,
    "showEndless enumerates the world map exactly once");
  assert.match(pick, /byWorldOrder\(Object\.keys\(/,
    "…and that enumeration is SORTED before it is rendered, never handed straight to .map");
  assert.equal((ui.match(/byWorldOrder\(/g) || []).length, 1,
    "one sorted world list in the whole shell — a second would be a second order to disagree with");

  // 2. the DAILY is the deliberate exception, and its raw order is load-bearing
  //    rather than sloppy: it indexes Object.keys(arenas) by the date hash, so
  //    the keys must stay put or every date re-points at a different board. Its
  //    own comment has to say so, because "sort these" is the obvious tidy-up.
  const main = read("scripts/td-main.js");
  assert.match(main, /Object\.keys\(DATA\.ENDLESS\.arenas\)/,
    "the daily rotation still derives its pool from the arenas that exist");
  const dat = read("scripts/td-data.js");
  assert.match(dat, /KEY ORDER of `arenas` IS LOAD-BEARING/i,
    "…and the data says so where a future author would re-order it");
  assert.equal((strip(main).match(/byWorldOrder/g) || []).length, 0,
    "the daily must NOT be 'fixed' to campaign order — that would re-point every past date");
});

test("guardrail: \"has this level been beaten\" has exactly ONE owner", () => {
  // The grid's unlock rule, the count under each difficulty chip and the
  // victory screen's "🔓 unlocked!" claim all ask the same question, and the
  // third one used to answer it with "does a next level exist" — so replaying a
  // beaten level announced its unlock all over again. A second copy of this
  // predicate is how the count under a chip could advertise a number the grid
  // then contradicts.
  const ui = read("scripts/td-ui.js").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  assert.equal((ui.match(/const beatenOn = /g) || []).length, 1, "the predicate is defined once");
  assert.match(ui, /UI\.levelBeaten = beatenOn/, "…and exported rather than re-implemented");
  // the star-count comparison itself must live in that one place
  assert.equal((ui.match(/\| 0\) >= 1/g) || []).length, 1,
    "a second copy of \"beaten means at least one star\" is how two surfaces disagree");
  const main = read("scripts/td-main.js").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  assert.match(main, /UI\.levelBeaten\(save, st\.difficulty, st\.levelId\)/,
    "the win path asks the owner whether the next level was ALREADY open");
  assert.match(main, /nextIsNew:/, "…and passes the answer to the victory screen");
});

test("guardrail: the stale-clone SessionStart hook exists AND is wired", () => {
  // This container restores its writable disk from a SNAPSHOT, so a session can
  // begin with the repo rolled back to an old commit while `git status` reads
  // perfectly clean — it happened twice in one day and destroyed an entire
  // uncommitted change. .claude/resync-main.sh is what heals that, and
  // settings.json is what makes it run.
  //
  // Both had ZERO coverage: their only mention in any test was the tree check's
  // hand-written allowlist, which asserts they exist rather than deriving it. The
  // failure mode is the worst kind — silent. Nothing goes red; the container just
  // starts losing work again.
  const cfg = JSON.parse(read(".claude/settings.json"));
  const hooks = ((cfg.hooks || {}).SessionStart || []).flatMap((h) => h.hooks || []);
  const cmds = hooks.filter((h) => h.type === "command").map((h) => String(h.command));
  assert.ok(cmds.length >= 1, "settings.json must register at least one SessionStart command hook");
  assert.ok(cmds.some((c) => c.includes("resync-main.sh")),
    `SessionStart must run resync-main.sh — otherwise the script can sit in the repo doing nothing, ` +
    `and a rolled-back clone silently eats the next uncommitted change. Registered: ${JSON.stringify(cmds)}`);

  // …and the script it names must actually be there and runnable.
  const sh = read(".claude/resync-main.sh");
  assert.match(sh, /^#!/, "the hook script needs a shebang — it is invoked as a command");
  assert.ok(fs.statSync(path.join(root, ".claude/resync-main.sh")).mode & 0o111,
    "the hook script must be executable, or SessionStart silently fails");

  // The SAFETY properties are what make it acceptable to run automatically at all.
  // COMMENT-STRIPPED first: the script's own header discusses why a blanket
  // `git reset --hard` would be wrong, so a naive ban would match its own
  // documentation — the trap this repo has hit four times.
  const code = sh.split("\n").filter((l) => !/^\s*#/.test(l)).join("\n");
  assert.match(code, /rev-parse --git-dir/, "it must confirm it is in a git work tree before anything");
  assert.match(code, /--porcelain\b/,
    "it must test the tree is CLEAN — resetting a DIRTY tree would destroy exactly the uncommitted work it exists to protect");
  assert.match(code, /merge --ff-only/,
    "it may only FAST-FORWARD: anything that rewrites or discards history is not a heal, it is the bug");
  assert.match(code, /"\$branch" = "main"/,
    "it must act only on main — a side branch's divergence is deliberate, not a rollback");
  assert.ok(!/reset --hard/.test(code),
    "it must never hard-reset; --ff-only is the whole safety argument");
  assert.ok((code.match(/exit 0/g) || []).length >= 4,
    "every bail-out must exit 0 — a network blip at SessionStart must not wedge the session");
});

test("guardrail: the stale-clone hook BEHAVES — all six branches driven in throwaway clones", () => {
  // The sibling guardrail above is STRUCTURAL: it proves the script contains the
  // right idioms. This drives it. A scan proving a call site exists must be
  // paired with something that proves the call does anything — and for this
  // script the stakes are the whole reason it exists: case 2 below is the one
  // where a careless version destroys the very uncommitted work it protects.
  const os = require("node:os");
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "josh-resync-"));
  const sh = (cmd, cwd) => execFileSync("bash", ["-c", cmd], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  try {
    sh("git init -q --bare origin.git && git clone -q origin.git work", tmp);
    const work = path.join(tmp, "work");
    sh("git config user.email t@t && git config user.name t && mkdir -p .claude", work);
    fs.copyFileSync(path.join(root, ".claude/resync-main.sh"), path.join(work, ".claude/resync-main.sh"));
    fs.chmodSync(path.join(work, ".claude/resync-main.sh"), 0o755);
    sh("echo A > f.txt && git add -A && git commit -qm A && git branch -M main && git push -q origin main", work);
    const A = sh("git rev-parse HEAD", work).trim();
    sh("echo B > f.txt && git commit -qam B && git push -q origin main", work);
    const B = sh("git rev-parse HEAD", work).trim();
    const head = () => sh("git rev-parse HEAD", work).trim();
    const run = () => {
      try { return { out: sh("./.claude/resync-main.sh 2>&1", work), code: 0 }; }
      catch (e) { return { out: String(e.stdout || "") + String(e.stderr || ""), code: e.status }; }
    };
    // The fixture must be able to tell the cases apart, or every clause below is
    // vacuous — assert the two commits really differ before relying on them.
    assert.notEqual(A, B, "fixture: the two commits must differ");

    // 1. BEHIND + clean — the rollback itself. Must fast-forward, and say so.
    sh(`git reset --hard -q ${A}`, work);
    let r = run();
    assert.equal(r.code, 0, "the hook must always exit 0");
    assert.equal(head(), B, "a rolled-back CLEAN clone must be fast-forwarded to origin/main");
    assert.match(r.out, /rolled back/i, "…and it must SAY so, or the session silently starts from an old tree");

    // 2. BEHIND + DIRTY — the case that must never be 'healed'. Resetting here
    //    would destroy exactly the uncommitted work the hook exists to protect.
    sh(`git reset --hard -q ${A} && echo local > uncommitted.txt`, work);
    r = run();
    assert.equal(r.code, 0, "the hook must always exit 0");
    assert.equal(head(), A, "a DIRTY rolled-back clone must be LEFT ALONE");
    assert.ok(fs.existsSync(path.join(work, "uncommitted.txt")),
      "…and its uncommitted file must survive untouched");
    assert.match(r.out, /NOT touching/i, "…and it must warn loudly, since only the human can save that work");
    fs.unlinkSync(path.join(work, "uncommitted.txt"));

    // 3. AHEAD — unpushed commits are not a rollback.
    sh(`git reset --hard -q ${B} && echo C > f.txt && git commit -qam C`, work);
    const C = head();
    r = run();
    assert.equal(head(), C, "an AHEAD clone holds unpushed work — it must be left alone");
    // Being left alone is not enough, and finding that out is why this clause
    // exists: `merge --ff-only` REFUSES to rewind, so an ahead clone survives
    // even when the ancestor test is broken — the ff-only flag is the safety and
    // the ancestor test is the CLASSIFICATION. Mis-classified, a perfectly normal
    // "I have not pushed yet" opens the session with "the fast-forward failed,
    // resync before trusting local files", which sends the next session hunting a
    // rollback that never happened. That is the false-positive machine this repo
    // refuses to ship, so the WORDING is the assertion.
    assert.match(r.out, /unpushed/i,
      "an AHEAD clone must be named as unpushed work…");
    assert.ok(!/failed/i.test(r.out),
      `…and never reported as a failure — nothing failed. Said: ${JSON.stringify(r.out.trim())}`);

    // 4. Not on main — a side branch's divergence is deliberate, and silent.
    sh(`git checkout -q -b side ${A}`, work);
    r = run();
    assert.equal(head(), A, "off main, the hook must do nothing");
    assert.equal(r.out.trim(), "", "…and say nothing: a side branch is not a fault to warn about");

    // 5. In sync — the normal case must be SILENT, or every session opens with noise.
    sh(`git checkout -q main && git reset --hard -q ${B}`, work);
    r = run();
    assert.equal(head(), B, "an in-sync clone is untouched");
    assert.equal(r.out.trim(), "", "the normal case must print nothing at all");
    assert.equal(r.code, 0, "the hook must always exit 0");

    // 6. NOT A GIT REPO AT ALL. SessionStart fires wherever the platform points
    //    it, including a fresh environment where the clone does not exist yet —
    //    so it must bail silently rather than spraying git errors across the
    //    start of every session. Note this pins the OUTCOME, not a line: TWO
    //    guards deliver it (`rev-parse --git-dir`, and the `|| exit 0` on the
    //    branch read), so removing either alone stays green — measured, and
    //    stated rather than implied. Removing BOTH turns this red with
    //    "fatal: not a git repository" as the session's opening words.
    const bare = path.join(tmp, "nogit", ".claude");
    fs.mkdirSync(bare, { recursive: true });
    fs.copyFileSync(path.join(root, ".claude/resync-main.sh"), path.join(bare, "resync-main.sh"));
    fs.chmodSync(path.join(bare, "resync-main.sh"), 0o755);
    assert.ok(!fs.existsSync(path.join(tmp, "nogit", ".git")), "fixture: nogit/ must not be a repo");
    let n;
    try { n = { out: sh("./.claude/resync-main.sh 2>&1", path.join(tmp, "nogit")), code: 0 }; }
    catch (e) { n = { out: String(e.stdout || "") + String(e.stderr || ""), code: e.status }; }
    assert.equal(n.code, 0, "outside a git tree the hook must still exit 0");
    assert.equal(n.out.trim(), "",
      `outside a git tree it must say NOTHING — git's own errors are not a session-start message. Said: ${JSON.stringify(n.out.trim())}`);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("DOCS: the repo tree names every file, and no plan claims to be unbuilt while it ships", () => {
  // Two halves of one recurring defect — "a list that outlives its contents",
  // which this file records four times: PLAN_WORLD_9 said DESIGNED-NOT-BUILT
  // after the world shipped, the "ideas for more games" list was entirely
  // built, CLAUDE.md's own open-items said 华丽's painted pass was still open
  // a release after it landed, and PLAN_WORLD_4 said "NOT SHIPPED" while all
  // four of its levels were live under exactly the names it lists. A stale doc
  // is worse than no doc: it sends the next author to build what exists, or to
  // trust a tree that has quietly stopped describing the repo.
  const fsx = require("node:fs");
  const doc = read("CLAUDE.md");
  const tree = doc.slice(doc.indexOf("## Repository Structure"), doc.indexOf("## Current Site Behavior"));
  assert.ok(tree.length > 2000, "could not isolate the repo-structure block — this test would be vacuous");

  // HALF 1: every file that exists is named. Derived by walking the repo, so a
  // new script/test/tool/workflow is covered the day it lands, not the day
  // someone remembers to extend a list.
  const real = [];
  for (const d of ["scripts", "tests", "tools", "styles"]) {
    for (const f of fsx.readdirSync(path.join(root, d))) {
      if (/\.(js|css)$/.test(f)) real.push(`${d}/${f}`);
    }
  }
  const walkYml = (d) => {
    for (const e of fsx.readdirSync(path.join(root, d), { withFileTypes: true })) {
      if (e.isDirectory()) walkYml(`${d}/${e.name}`);
      else if (/\.ya?ml$/.test(e.name)) real.push(`${d}/${e.name}`);
    }
  };
  walkYml(".github");
  // .claude too. Its two files had ZERO coverage: the only mention of either in
  // any test was the hand-written allowlist below, which ADDS them to the "this
  // exists" set by fiat — so deleting them broke nothing that anything checks.
  // That matters because resync-main.sh is the SessionStart hook that heals the
  // stale-clone rollback, and its failure mode is silent: the container would
  // simply start losing work again with no red test and no error.
  for (const f of fsx.readdirSync(path.join(root, ".claude"))) {
    if (/\.(sh|json)$/.test(f)) real.push(`.claude/${f}`);
  }
  for (const f of fsx.readdirSync(root)) if (/^PLAN_.*\.md$/.test(f)) real.push(f);
  // …and every shipped PAGE. wordcards.html is a whole game living in one
  // root .html, and the walk covered scripts/tests/tools/styles but no HTML,
  // so a second page could ship undocumented.
  for (const f of fsx.readdirSync(root)) if (/\.html$/.test(f)) real.push(f);
  assert.ok(real.length > 30, `expected to find the repo's files, saw ${real.length}`);
  const unnamed = real.filter((f) => !tree.includes(f.split("/").pop()));
  assert.deepEqual(unnamed, [],
    `these files exist but the repo tree in CLAUDE.md never names them:\n  ${unnamed.join("\n  ")}`);

  // …and the reverse: a name in a tree ENTRY must be a file that exists. Only
  // entry lines are checked, never the comments beside them — those legitimately
  // reference paths outside the repo (a scratchpad spec, for instance).
  const have = new Set(real.map((f) => f.split("/").pop()));
  // settings.json and resync-main.sh are NO LONGER here — they are walked above,
  // so their existence is derived rather than granted. What is left is only the
  // root files this walk deliberately does not collect.
  for (const extra of ["index.html", "sw.js", "manifest.webmanifest", "package.json",
    "package-lock.json", "CLAUDE.md", "JOSH_PROFILE.md", "josh-profile.json",
    ".gitignore"]) have.add(extra);
  const ghosts = [];
  for (const line of tree.split("\n")) {
    if (!line.includes("──")) continue;
    const entry = line.split("#")[0];
    const m = entry.match(/([\w.-]+\.(?:webmanifest|json|yaml|html|css|yml|js|md|sh))(?![\w])/);
    if (m && !have.has(m[1])) ghosts.push(m[1]);
  }
  assert.deepEqual(ghosts, [],
    `the repo tree names files that do not exist: ${ghosts.join(", ")}`);

  // HALF 2: a WORLD plan may not call itself unbuilt while its world ships.
  //
  // Scoped hard, because the loose version is a false-positive machine and this
  // repo does not ship those. Matching "NOT SHIPPED" anywhere in the header
  // flagged two docs that are both CORRECT: PLAN_MINIBOSS says "NOT BUILT AS
  // CONTENT", which is an accurate refutation that happens to name shipped
  // levels while discussing where a finale could go; and PLAN_WORLD_4's own
  // corrected header contains the words "NOT SHIPPED" while EXPLAINING that it
  // used to say that. So the check reads the status VERDICT — the first bolded
  // token after "Status:" — and compares it against the one fact that is
  // unambiguous: whether the world key the doc names has levels in DATA.LEVELS.
  const DATA = require("../scripts/td-data.js");
  const worlds = new Set(DATA.LEVELS.map((l) => l.world));
  const liars = [];
  let verdictsRead = 0;   // NOT `read` — that is this file's own file-reading helper
  // EVERY plan doc, not just PLAN_WORLD_*: the file list is part of the scan, and
  // this one was scoped to a name PREFIX while five docs outside it carried stale
  // verdicts (three ROAD_TO plans saying "not yet built" with Josh's 200 games
  // live, PLAN_TOWER_BRANCHES saying "no new branch has been added" with Rust Ray
  // and Tail Wind in DATA.TOWERS, and PLAN_EXPANSION saying "nothing here is
  // built" with all of phases 1-5 shipped). Widening the glob costs nothing and
  // adds no false-positive surface — the world-key test below simply never fires
  // on a doc that names no shipped world. It does NOT catch those five; nothing
  // derivable does, which is why they were fixed by hand and why no fuzzy
  // "mentions a shipped thing" rule was invented here (that version flagged two
  // CORRECT docs when it was tried).
  for (const f of fsx.readdirSync(root).filter((x) => /^PLAN_.*\.md$/.test(x))) {
    const txt = fsx.readFileSync(path.join(root, f), "utf8");
    // Read the verdict from EITHER bolding style. The first cut required
    // `Status: **verdict**` (bold after the colon) and half the docs write
    // `**Status: verdict**` (bold around the whole line) — so it silently
    // skipped 7 of 14, INCLUDING PLAN_WORLD_9 and PLAN_WORLD_10, the very shape
    // it exists to police. A scan that matches nothing reports nothing.
    // EVERY Status: line, not just the first. PLAN_TOWER_DEFENSE.md carries
    // three — a document verdict at the top and two per-phase section statuses
    // hundreds of lines down — and reading only the first meant a stale SECTION
    // status was being reported as the DOCUMENT's verdict for as long as the
    // doc had no header status at all. Scoping by line number is not the fix:
    // three docs (GIMMICKS, WORLD_5, WORLD_6) legitimately state their single
    // verdict at the END of the file. Reading them all needs no heuristic and
    // is strictly stronger — a stale "NOT BUILT" anywhere in a doc is a lie
    // wherever it sits.
    const lines = [...txt.matchAll(/^.*Status:.*$/gm)].map((m) => m[0].replace(/\*\*/g, ""));
    const line = lines.find((l) => /NOT\s+(SHIPPED|BUILT)/i.test(l)) || lines[0] || "";
    // Just the leading VERDICT, cut at the first clause boundary. Taking the
    // whole sentence is too greedy: PLAN_WORLD_4's corrected header reads
    // `✅ SHIPPED (on the second attempt) — this line read "NOT SHIPPED" for…`,
    // and swallowing that quote makes a CORRECTED doc look like a lying one —
    // the exact false positive this guardrail was scoped hard to avoid.
    const verdict = (line.split(/Status:\s*/)[1] || "").split(/[.\n(—"]/)[0].trim();
    if (verdict) verdictsRead += 1;
    if (!verdict || !/NOT\s+(SHIPPED|BUILT)/i.test(verdict)) continue;
    // DERIVE the world from the FILENAME, not from prose. The old detector
    // required the literal `` world `key` `` and that phrasing appears in
    // exactly ONE doc (PLAN_WORLD_4, the one it was written against) — so it
    // was a single-case check wearing a law's clothes, and PLAN_WORLD_9 and
    // PLAN_WORLD_10 could each have claimed NOT BUILT with all four of their
    // levels live. A world is four levels, so PLAN_WORLD_<N> is levels
    // 4N-3..4N: if level 4N is in DATA.LEVELS, that world shipped. No text
    // matching, nothing to phrase wrong.
    const n = Number((f.match(/^PLAN_WORLD_(\d+)\.md$/) || [])[1] || 0);
    const shipped = n ? DATA.LEVELS.find((l) => l.id === n * 4) : null;
    const named = shipped
      ? [shipped.world]
      : [...new Set([...txt.matchAll(/`(\w+)`/g)].map((m) => m[1]))].filter((w) => worlds.has(w));
    if (named.length) liars.push(`${f} says "${verdict}" but world(s) ${named.join(", ")} are in DATA.LEVELS`);
  }
  assert.deepEqual(liars, [], `plan docs that outlived their contents:\n  ${liars.join("\n  ")}`);
  // …and the scan must actually have READ them. A derivation fails OPEN: if the
  // Status regex stops matching, every doc is skipped and this test passes while
  // checking nothing — which is precisely the state it was in.
  // EVERY plan doc, not "almost all". The floor used to be `>= 12` against 13
  // docs, which permitted exactly one to carry no Status line at all — and one
  // did: PLAN_TOWER_DEFENSE.md, the fort's foundational design, whose header
  // still described a name gate that was removed and a campaign of 12 levels
  // that is now 40. A doc with no verdict is not caught by this law, it is
  // INVISIBLE to it, so the honest floor is all of them.
  const planDocs = fsx.readdirSync(root).filter((x) => /^PLAN_.*\.md$/.test(x));
  assert.ok(planDocs.length >= 12, `the plan-doc list must not be empty (saw ${planDocs.length})`);
  assert.equal(verdictsRead, planDocs.length,
    `${planDocs.length - verdictsRead} plan doc(s) carry no readable "Status:" verdict, so this law cannot ` +
    `see them at all — every PLAN_*.md must state whether it is built, or a stale design ` +
    `sends the next author to build something that already ships`);
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

  assert.match(wd, /listWorkflowRuns\(\{[\s\S]{0,200}head_sha: *sha/,
    "it must look for runs of THIS head commit, or it cannot tell a missed deploy from an old one");

  // SILENCE #1 — the push fired nothing at all.
  assert.match(wd, /list\.length === 0[\s\S]{0,200}?kick\(/,
    "zero runs for the head commit must still dispatch — that is the original failure this exists for");

  // SILENCE #2 — a run EXISTED and never shipped. It cost two commits on
  // 2026-08-18: a hung install held the `pages` concurrency group, the pushes
  // behind it came back `cancelled`, and the live site quietly served an older
  // build with nothing red. "A run exists" was a PROXY for "the site is
  // current", and it stopped tracking it the moment a run could exist without
  // publishing — so the watchdog now checks the property itself.
  assert.match(wd, /fetch\(url/,
    "it must actually read the live site — that is the property, everything else is a proxy for it");
  assert.match(wd, /includes\(`v=\$\{sha\.slice\(0, 8\)\}`\)[\s\S]{0,160}?return;/,
    "…and must do nothing when the live site already serves this commit");
  assert.match(wd, /html === null\) return;/,
    "an UNREACHABLE site is not a stale one — a network blip must never trigger a deploy");

  // THE SAFETY PROPERTY, now four independent brakes. Each is what stops this
  // becoming a retry loop, and a broken build must cross NONE of them.
  assert.match(wd, /ACTIVE *= *\[[^\]]*"in_progress"[\s\S]{0,240}?return;/,
    "brake 1: a run still queued or in progress must be waited for, never raced");
  assert.match(wd, /conclusion === "failure"[\s\S]{0,240}?return;/,
    "brake 2: a genuinely FAILED deploy must be left red — this is the difference from a retry loop");
  assert.match(wd, /event === "workflow_dispatch"[\s\S]{0,240}?return;/,
    "brake 3: one kick per commit — a dispatched run already existing must stop it dead");

  // and it must not race a run that is simply still being created, nor call the
  // site stale while a ~35-minute pipeline is still legitimately running.
  assert.match(wd, /ageMin < 10[\s\S]{0,200}?return;/,
    "it must ignore a commit younger than ~10 min; a healthy push creates its run within seconds");
  assert.match(wd, /ageMin < 45[\s\S]{0,200}?return;/,
    "…and must not judge the live site before a full deploy could plausibly have finished");
});

test("CI: the watchdog's brakes actually BRAKE, and its two silences actually dispatch", () => {
  // The test above proves the call sites EXIST. It cannot prove they DO
  // anything — the recurring lesson here is that a structural scan proves a
  // line is present and only driving the feature proves it fires. For a
  // watchdog both failure modes are severe: one that never dispatches is
  // useless, and one that dispatches when it should not is a storm against a
  // build that is legitimately red. So the shipped script body is executed
  // against stubs, once per scenario.
  const wd = read(".github/workflows/deploy-watchdog.yml");
  const body = wd.split(/\n *script: \|\n/)[1];
  assert.ok(body, "could not find the watchdog's script: block — this test would be vacuous");
  const src = body.split("\n").map((l) => l.replace(/^ {12}/, "")).join("\n");
  assert.ok(/createWorkflowDispatch/.test(src), "extracted the wrong block");

  const SHA = "0123456789abcdef0123456789abcdef01234567";
  const run = async ({ ageMin, runs, live }) => {
    const dispatched = [];
    const github = {
      rest: {
        repos: {
          getBranch: async () => ({
            data: { commit: { sha: SHA, commit: { committer: { date: new Date(Date.now() - ageMin * 60000).toISOString() } } } },
          }),
        },
        actions: {
          listWorkflowRuns: async () => ({ data: { total_count: runs.length, workflow_runs: runs } }),
          createWorkflowDispatch: async (a) => { dispatched.push(a); },
        },
      },
    };
    const core = { info: () => {}, warning: () => {} };
    const context = { repo: { owner: "o", repo: "r" } };
    const fetchStub = async () => {
      if (live === "unreachable") throw new Error("ENOTFOUND");
      return { ok: true, text: async () => live };
    };
    const fn = new Function("github", "core", "context", "fetch", `return (async () => {\n${src}\n})();`);
    await fn(github, core, context, fetchStub);
    return dispatched.length;
  };

  const ok = (sha) => ({ status: "completed", conclusion: "success", event: "push", run_number: 1 });
  const cancelled = { status: "completed", conclusion: "cancelled", event: "push", run_number: 2 };
  const failed = { status: "completed", conclusion: "failure", event: "push", run_number: 3 };
  const busy = { status: "in_progress", conclusion: null, event: "push", run_number: 4 };
  const kicked = { status: "completed", conclusion: "cancelled", event: "workflow_dispatch", run_number: 5 };
  const CUR = `<script src="./scripts/main.js?v=${SHA.slice(0, 8)}"></script>`;
  const OLD = `<script src="./scripts/main.js?v=deadbeef"></script>`;

  const cases = [
    // SILENCE #1 — the push fired nothing. The original reason this exists.
    ["no run at all, old enough", { ageMin: 20, runs: [], live: OLD }, 1],
    ["no run at all, too fresh", { ageMin: 5, runs: [], live: OLD }, 0],
    // SILENCE #2 — a run existed and never shipped (4c98dee / df77afc).
    ["runs cancelled, site stale", { ageMin: 60, runs: [cancelled], live: OLD }, 1],
    ["runs cancelled, site CURRENT", { ageMin: 60, runs: [cancelled], live: CUR }, 0],
    ["succeeded but never published", { ageMin: 60, runs: [ok()], live: OLD }, 1],
    ["stale but too early to judge", { ageMin: 20, runs: [cancelled], live: OLD }, 0],
    // THE BRAKES
    ["brake 1: a run is still active", { ageMin: 60, runs: [busy, cancelled], live: OLD }, 0],
    ["brake 2: a run FAILED", { ageMin: 60, runs: [failed, cancelled], live: OLD }, 0],
    ["brake 3: already kicked once", { ageMin: 60, runs: [kicked], live: OLD }, 0],
    ["a network blip is not staleness", { ageMin: 60, runs: [cancelled], live: "unreachable" }, 0],
  ];
  return (async () => {
    for (const [name, input, want] of cases) {
      const got = await run(input);
      assert.equal(got, want, `${name}: expected ${want} dispatch(es), got ${got}`);
    }
  })();
});

test("CI: installing browsers CANNOT hang — one owner, a timeout, and a retry", () => {
  // The watchdog above recovers a push that created NO run. This is the OTHER
  // silence, and it cost two commits: on 2026-08-18 `npx playwright install`
  // HUNG. The measured norm is 57s (run #301, the last green one); run #304 sat
  // on it for 92 minutes. Because deploy.yml is `concurrency: group: pages,
  // cancel-in-progress: false`, a hung run holds the group for up to GitHub's
  // 6-hour ceiling and drops everything queued behind it — so 4c98dee and
  // df77afc both came out `cancelled`, nothing went red, and the live site kept
  // serving abf31db. The watchdog cannot help: it stops the moment a run
  // EXISTS, which is exactly the anti-loop property that makes it safe.
  //
  // So a hang is prevented at the source, and this pins that it stays prevented.
  const dep = read(".github/workflows/deploy.yml");
  const act = read(".github/actions/install-browsers/action.yml");
  // Comment-stripped, because the rules are explained IN the action and a scan
  // that matches its own documentation is this repo's most-repeated own goal.
  const actCode0 = act.split("\n").filter((l) => !/^\s*#/.test(l)).join("\n");

  // ONE owner. If a third job ever inlines the command it skips the retry
  // silently — the "same computation in two places" bug this repo keeps paying
  // for, here with the second copy being the one that hangs.
  assert.equal((dep.match(/playwright install/g) || []).length, 0,
    "deploy.yml must not run `playwright install` itself — it goes through .github/actions/install-browsers");

  // DERIVED, so a future third job is covered without editing this test: every
  // step that installs browsers, found by its own name, must come through the
  // action and must carry a backstop timeout.
  const steps = dep.split(/\n {6}- /).slice(1);
  const installers = steps.filter((s) => /^name:.*Install browsers/.test(s));
  assert.ok(installers.length >= 2,
    `expected the test and verify-live jobs to install browsers, found ${installers.length} — if this is 0 the whole test is vacuous`);
  for (const s of installers) {
    const name = s.split("\n")[0];
    assert.match(s, /uses: \.\/\.github\/actions\/install-browsers/,
      `"${name}" must install through the shared action, or it inherits no retry and no timeout`);
    assert.match(s, /timeout-minutes: *\d+/,
      `"${name}" must carry a backstop timeout-minutes — the composite's own steps cannot declare one`);
  }

  // The action has to do the three things its name claims. A "retry" that
  // cannot interrupt a stall is not a retry: the hang has to be BOUNDED per
  // attempt, or attempt 1 simply never returns and attempts 2-3 never happen.
  assert.match(act, /timeout[^\n]*PER_ATTEMPT/,
    "each attempt must be bounded by `timeout`, or a stalled attempt blocks the retries behind it");
  // …and errexit must be OFF. This is the one that actually bit, twice: Actions
  // runs `shell: bash` as `bash --noprofile --norc -eo pipefail {0}`, and
  // `set -uo pipefail` does not clear the -e. So the first failing attempt
  // exited the script before `code=$?` was read — no warning, no attempt 2, and
  // the step reported the command's own status (137 under KILL, 124 under
  // TERM). Runs #320 and #321 both died exactly there.
  assert.match(actCode0, /^\s*set \+e\b/m,
    "the script must clear errexit — Actions runs `shell: bash` with -e, so one failed attempt would end the loop");
  // …and a retry must be able to SUCCEED. `--with-deps` runs apt under sudo, in
  // a different session, so timeout's process-group kill misses it: run #324
  // had attempts 2 and 3 both die in ~20s on "Could not get lock … held by
  // process 2640 (apt-get)", the same pid attempt 1 had left running. A retry
  // that cannot win is not a retry.
  assert.match(actCode0, /clear_apt_locks\(\)\s*\{/,
    "the script must be able to clear a lock left by a killed attempt");
  assert.match(actCode0, /if \[ "\$i" -lt "\$ATTEMPTS" \]; then clear_apt_locks;/,
    "…and must do it BEFORE the next attempt, or the retry dies on the lock in 20 seconds");
  // -x (match the process NAME) never -f (match the full command line), which
  // would match this script's own cleanup line — the pkill trap that killed a
  // shell earlier the same day.
  assert.ok(!/pkill[^\n]*-f/.test(actCode0),
    "pkill must match process NAMES (-x), not command lines (-f) — -f matches the cleanup line itself");
  // --foreground looks like the fix and is the trap: it leaves the command in
  // the SHELL's process group, which reproduces the exact failure signature.
  assert.ok(!/--foreground/.test(actCode0),
    "never --foreground here: it puts the command back in the shell's own process group");
  // …and the attempt must be ATTRIBUTABLE. The browser cache made the download
  // free — run #326 installed in 29 SECONDS — yet run #328 still burned 53m32s
  // here while its own log said "Cache hit occurred on the primary key", i.e. it
  // downloaded nothing. So the stall is apt, and a combined `--with-deps` can
  // never say that: the two halves run as separate labelled commands inside ONE
  // timeout, which leaves the phase marker as the last line when a stall is
  // killed. One timeout, so the per-attempt budget and the retry arithmetic are
  // unchanged — this is diagnosis, not a re-tune.
  assert.ok(!/install --with-deps/.test(actCode0),
    "the combined --with-deps hides WHICH half stalled — run the two phases separately");
  assert.match(actCode0, /npx playwright install-deps [^\n]*chromium[^\n]*webkit/,
    "the apt half must be its own command, so a killed attempt names it");
  assert.match(actCode0, /npx playwright install chromium webkit/,
    "…and the browser half must be its own command too");
  assert.equal((actCode0.match(/timeout --signal/g) || []).length, 1,
    "both phases must sit inside ONE timeout, or an attempt could cost twice the bound and the 3 x PER_ATTEMPT arithmetic against the caller's backstop stops holding");
  for (const phase of [/::notice::install 1\/2/, /::notice::install 2\/2/]) {
    assert.match(actCode0, phase,
      "each phase must announce itself, or a killed attempt still cannot be attributed");
  }
  assert.match(act, /for i in \$\(seq 1 "\$ATTEMPTS"\)/,
    "it must actually loop — one bounded attempt turns a transient stall into a red build");
  assert.ok(/ATTEMPTS=([2-9]|\d\d)/.test(act),
    "…more than once");
  // and it must still FAIL when the retries are exhausted. A loop that falls
  // out with exit 0 would hide a genuinely broken install behind a green tick,
  // which is a worse bug than the hang it replaces.
  assert.match(act, /::error::[\s\S]{0,200}?exit 1\s*$/,
    "after the last attempt it must exit non-zero — a swallowed failure is worse than the hang");

  // …and the CDN comes off the critical path, which is the fix the third
  // re-measurement of the bound produced. The install is not drifting upward,
  // it is BIMODAL — run #319 measured 44s and 4m05s where run #317 measured
  // 17m47s and 17m39s hours earlier — and no value of PER_ATTEMPT makes a
  // third-party mirror reliable, it only decides how long we wait for it.
  assert.match(act, /uses: actions\/cache@v\d/,
    "the browsers must be cached, or every run re-downloads ~350MB from a mirror whose bad day once cost two commits");
  // The cached path must be the one `playwright install` ACTUALLY uses.
  // Caching a directory the install ignores is a no-op that looks like a fix
  // and reports a cache hit for ever, which is strictly worse than no cache:
  // it hides the download it was meant to remove. ~/.cache/ms-playwright is
  // Playwright's default on Linux, so nothing here may repoint it.
  assert.match(act, /path: *~\/\.cache\/ms-playwright/,
    "cache Playwright's DEFAULT browsers dir — caching a path the install does not use is a silent no-op");
  // Comment-stripped, because the rule is explained IN the action and a scan
  // that matches its own documentation is this repo's most-repeated own goal.
  assert.ok(!/PLAYWRIGHT_BROWSERS_PATH/.test(actCode0),
    "the action must not repoint PLAYWRIGHT_BROWSERS_PATH, or the cached path and the installed path diverge");
  // A key that never changes serves the wrong browsers after a Playwright
  // bump — for ever, since the entry is only rewritten on a miss.
  assert.match(act, /key: *[^\n]*hashFiles\('package-lock\.json'\)/,
    "the cache key must be derived from the lockfile, or a Playwright version bump keeps restoring the old browsers");
});

test("CI: the browser-install retry actually RETRIES, and names a hang a hang", () => {
  // The structural test above pins that a retry EXISTS. It cannot pin that it
  // WORKS, and the first cut of this action did not: it captured the attempt's
  // status as `code=$?` immediately after an `if`, and a failed `if` condition
  // with no else leaves the compound statement's own status of 0 — so `code`
  // was always 0, the HUNG branch could never fire, and a real exit 7 was
  // reported as "failed with exit 0". Both bugs are invisible to a regex and
  // were found by RUNNING the thing, which is what this now does for good.
  //
  // It drives the SHIPPED script text, substituting only the two timing
  // constants so a hang case takes seconds instead of 36 minutes — and it
  // asserts those constants are present first, because a substitution that
  // silently matches nothing would leave this testing the wrong thing.
  const os = require("node:os");
  const { spawnSync } = require("node:child_process");

  const act = read(".github/actions/install-browsers/action.yml");
  const body = act.split(/\n *run: \|\n/)[1];
  assert.ok(body, "could not find the action's run: block — this test would otherwise be vacuous");
  const script = body.split("\n").map((l) => l.replace(/^ {8}/, "")).join("\n");
  // DERIVED, not pinned. Pinning `PER_ATTEMPT=1200` here made a pure re-tune
  // of the timeout break a test about RETRY BEHAVIOUR, which teaches the next
  // author to edit the test rather than think about the bound — and the bound
  // has already moved three times. Reading the constants keeps the
  // substitution honest (it still cannot silently no-op) while leaving the
  // value free to move.
  const consts = {};
  for (const k of ["PER_ATTEMPT", "ATTEMPTS", "BACKOFF"]) {
    const m = script.match(new RegExp(`^${k}=(\\d+)$`, "m"));
    assert.ok(m, `expected ${k}=<number> in the shipped script; the substitution below would no-op`);
    consts[k] = Number(m[1]);
  }
  assert.ok(consts.ATTEMPTS >= 2, "one attempt is not a retry");
  const fast = script
    .replace(`PER_ATTEMPT=${consts.PER_ATTEMPT}`, "PER_ATTEMPT=1")
    .replace(`BACKOFF=${consts.BACKOFF}`, "BACKOFF=0");
  assert.notEqual(fast, script,
    "the timing substitution changed nothing — this would test the shipped 25-minute timings and time out");

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "josh-install-"));
  fs.mkdirSync(path.join(dir, "bin"));
  fs.writeFileSync(path.join(dir, "script.sh"), fast);
  const run = (stub) => {
    fs.writeFileSync(path.join(dir, "bin", "npx"), stub, { mode: 0o755 });
    // `bash -e`, because that is how Actions invokes it — and driving the
    // shipped script text with a PLAIN `bash` is exactly why this guardrail was
    // green through two red CI runs. A harness is only as faithful as its
    // invocation, not just its input. (Verified both ways: plain bash gives 3
    // attempts and exit 1; `bash -e` on the pre-fix script gives 0 attempts and
    // the command's own exit code, byte-for-byte the CI signature.)
    // setsid keeps the group-kill case below from walking out and killing
    // `node --test` itself, which it otherwise does.
    const r = spawnSync("setsid", ["--wait", "bash", "-e", path.join(dir, "script.sh")], {
      encoding: "utf8", timeout: 60000,
      env: { ...process.env, PATH: `${path.join(dir, "bin")}:${process.env.PATH}` },
    });
    return { code: r.status, out: (r.stdout || "") + (r.stderr || "") };
  };

  // A download that never returns is the case this whole action exists for.
  // It must be BOUNDED (or the retries behind it never happen), must end red,
  // and must SAY it hung — a run that reports "failed with exit 0" sends the
  // next person looking for a broken install instead of a stalled network.
  const hang = run("#!/bin/bash\nexec sleep 999\n");
  assert.equal(hang.code, 1, "a permanent hang must end as a real failure, not a green tick");
  assert.equal((hang.out.match(/HUNG/g) || []).length, consts.ATTEMPTS,
    `every attempt must be killed and reported as a HANG, saw: ${hang.out.trim().split("\n").join(" | ")}`);

  // THE MECHANISM THAT ACTUALLY BIT, which the hang case above cannot see: an
  // attempt whose death signals its own process GROUP. On run #320 that took
  // the retry loop down with it — `exit 137`, zero warnings, no attempt 2 —
  // while this very test was green, because a local shell's process-group
  // topology is not the runner's. So the property is asserted against the
  // mechanism instead: whatever the attempt does to its own group, the loop
  // must still make every attempt and still end red. (Mutation-proven by
  // adding --foreground and dropping setsid, which reproduces #320's exact
  // signature: 0 attempts, exit 137. Note it does NOT go red on dropping
  // setsid alone, because a plain interactive-shell topology already isolates
  // the group — the structural clause above is what pins that half.)
  const grouped = run("#!/bin/bash\nsleep 0.2\nkill -KILL 0\n");
  assert.equal(grouped.code, 1,
    "an attempt that signals its own process group must not take the retry loop with it");
  assert.equal((grouped.out.match(/HUNG|failed with exit/g) || []).length, consts.ATTEMPTS,
    `every attempt must still run, saw: ${grouped.out.trim().split("\n").join(" | ")}`);

  // …and a transient failure must actually be recovered, with the REAL exit
  // code reported for the attempts that failed.
  const counter = path.join(dir, "n");
  const flaky = run(`#!/bin/bash\nn=$(cat ${counter} 2>/dev/null || echo 0); n=$((n+1)); echo $n > ${counter}\n[ "$n" -ge ${consts.ATTEMPTS} ] && exit 0 || exit 7\n`);
  assert.equal(flaky.code, 0, "transient failures then a success must end green — that is what the retry is for");
  assert.match(flaky.out, new RegExp(`installed on attempt ${consts.ATTEMPTS}`), "it must report which attempt succeeded");
  assert.match(flaky.out, /attempt 1 failed with exit 7/,
    `a failed attempt must report its REAL exit code, saw: ${flaky.out.trim().split("\n").join(" | ")}`);
});

test("the guide's side-door entry describes the door we actually ship", () => {
  // The door was reported as unanticipatable twice, and the fix was to warn a
  // WAVE early rather than at the moment it opens. The guide text is the only
  // place that tells a player the notice exists — and player copy cannot go
  // red on its own, so a feature can be improved and its description left
  // describing the broken version. Ties the sentence to the renderer that
  // implements it: if one goes, the other must.
  const logic = read("scripts/td-logic.js");
  const door = logic.match(/name: "Side Door",[\s\S]{0,600}?\}\);/);
  assert.ok(door, "the guide must still carry a Side Door entry");
  assert.match(door[0], /BEFORE it opens/,
    "the side-door entry must say the warning comes a wave EARLY — that is the whole fix");
  assert.match(read("scripts/td-render.js"), /function soonDoors|soonDoors\s*=/,
    "…and the renderer must actually draw that advance warning");
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
  // The population was FOUR hand-picked files of the twenty-six the page loads —
  // scoped to where the defect was FOUND (a fort dialog), not to what the law is
  // ABOUT. content.js is this repo's "ALL editable content" file and
  // hl-content.js holds every Chinese string, and BOTH sat outside a law about
  // player-facing copy. It is now every script the page loads PLUS each shipped
  // page's own inline <script>, which no SCRIPTS-derived scan can see (Word Cards
  // is 493 cards of player copy in one inline block). tools/ and tests/ stay out
  // for free — the page does not load them, and they use this vocabulary
  // constantly. Measured 0 hits across all 28 sources first, so this is a
  // tightening of a passing check rather than a newly-blocked build.
  const SOURCES = [
    ...SCRIPTS.map((f) => [f, read(f)]),
    // Each page's inline <script> bodies, spliced back in at their real offsets
    // with everything else blanked out (newlines preserved). Joining the blocks
    // instead would renumber every line, and a failure naming the wrong line
    // sends the next person to the wrong place.
    ...PAGES.map((f) => {
      const src = read(f);
      let out = src.replace(/[^\n]/g, " ");
      for (const m of src.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)) {
        const at = m.index + m[0].indexOf(m[1]);
        out = out.slice(0, at) + m[1] + out.slice(at + m[1].length);
      }
      return [f, out];
    }),
  ];
  // …and it reads the STRING LITERALS, not the lines. The old form asked "does
  // this LINE hold a quote AND a banned word", stripping only a FULL-LINE
  // comment — so a TRAILING comment was a live false-positive vector, and not
  // hypothetically: this vocabulary saturates these very files' comments (81
  // occurrences in full-line comments, and one already sitting in a trailing
  // comment at td-logic.js:2406, a single quote away from firing). Widening 4
  // sources to 28 multiplies that surface, so the scan now reads exactly what it
  // claims to police — text that reaches the screen. A comment is never inside a
  // string literal, so the whole class stops existing rather than being stripped.
  const stringLiterals = (src) => {
    const out = [];
    for (let i = 0; i < src.length; ) {
      const c = src[i];
      if (c === "/" && src[i + 1] === "/") { while (i < src.length && src[i] !== "\n") i++; continue; }
      if (c === "/" && src[i + 1] === "*") { i += 2; while (i < src.length && !(src[i] === "*" && src[i + 1] === "/")) i++; i += 2; continue; }
      if (c === '"' || c === "'" || c === "`") {
        let j = i + 1, buf = "";
        for (; j < src.length; j++) {
          if (src[j] === "\\") { buf += src[j + 1] || ""; j++; continue; }
          if (src[j] === c) break;
          if (c !== "`" && src[j] === "\n") break;   // unterminated: bail rather than swallow the rest of the file
          buf += src[j];
        }
        out.push({ text: buf, line: src.slice(0, i).split("\n").length });
        i = j + 1; continue;
      }
      i++;
    }
    return out;
  };
  const hits = [];
  let literals = 0;
  for (const [f, src] of SOURCES) {
    for (const lit of stringLiterals(src)) {
      literals += 1;
      for (const b of BANNED) {
        if (lit.text.toLowerCase().includes(b.toLowerCase())) hits.push(`${f}:${lit.line} — "${b}"`);
      }
    }
  }
  // The DEFECT clause first, then the non-vacuity floor — a mutation must fire
  // the claim rather than the guard.
  assert.deepEqual(hits, [],
    "these are test-suite words in a string that reaches the screen — say what the feature DOES:\n  " + hits.join("\n  "));
  // The extractor IS the scan now, so it needs its own floor: a desync or a
  // broken walk makes every clause above vacuous while staying green. 20535
  // today across 28 sources, so this separates working from silent, and does not
  // sit on the value it must separate from.
  assert.ok(literals > 5000, `only ${literals} string literals extracted — the scan failed OPEN`);
});

test("the game stage centres its play on the axis it actually has", () => {
  // `.game__stage` is a GRID, and on a grid `justify-content` is the INLINE
  // axis. The in-game rule declared `justify-content: safe center` under a
  // comment saying it "centres the play vertically" — so the vertical centering
  // it describes was never happening: the grid's auto rows simply stretched to
  // fill the screen, which looks like filling and is not centering.
  //
  // The cost was measured, ink-to-ink (a box-gap metric cannot see it, because
  // the question's own box IS the stretched row): on a 834x1112 tablet, 43 games
  // had 300px or more of visible emptiness between a question and its answers,
  // 75 had 200px or more, worst 466px — against 23 at 200px on a phone. Adding
  // the row-axis property took 300px+ from 43 games to ZERO and 200px+ to zero.
  //
  // `safe` on both, so tall content is never clipped — it falls back to
  // start-alignment and the page scrolls, exactly as the original comment
  // promised.
  const css = require("fs").readFileSync("styles/main.css", "utf8");
  const rule = css.match(/body\.in-game \.game__stage \{[^}]*\}/);
  assert.ok(rule, "the in-game stage rule must exist");
  assert.match(rule[0], /align-content:\s*safe center/,
    "a grid centres its ROWS with align-content; justify-content is the inline axis and cannot do it");
  assert.match(rule[0], /justify-content:\s*safe center/,
    "…and the inline centring stays, so a narrow child is still centred");
});

test("guardrail: remembered AIM goes through the engine, and nested save defaults are covered", () => {
  const raw = read("scripts/td-main.js");
  const tdm = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

  // ONE owner, and it must ASK THE ENGINE. Assigning `t.targeting` directly
  // would look identical for every legal mode and would silently apply an
  // ILLEGAL one — a `cheap` remembered from before a 🔻 Weak Spot respec — which
  // setTargeting refuses (`locked`). The browser test proves the refusal; this
  // proves no OTHER site can grow that bypasses it. Comment-stripped, because
  // applyAim's own comment explains the rule using the words it bans — a scan
  // that counts its own documentation is this repo's most-repeated defect.
  const writes = (tdm.match(/\.targeting\s*=/g) || []).length;
  assert.equal(writes, 0,
    `the UI must never assign a tower's targeting directly (${writes} site(s)) — it goes through ` +
    "engine.setTargeting, which is what refuses a mode this run has not unlocked");
  assert.equal((tdm.match(/function applyAim\(/g) || []).length, 1,
    "remembered aim has exactly ONE owner");
  // …and the guide must SAY it. A feature shipped without its description is the
  // side-door staleness class: player copy cannot go red on its own, so the two
  // are tied here — if the behaviour is ever removed, this sentence must go with
  // it, and if the sentence is dropped the behaviour becomes undiscoverable.
  const ui = read("scripts/td-ui.js").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  assert.match(ui, /remembered per[\s\S]{0,80}opens already aimed/,
    "the Toybox Guide's aiming section must say that the last choice is remembered per tower line");
  // Same law, one control over: the preview now stays up whenever RUSH is on
  // offer, and a feature improved with its description left behind is the
  // side-door staleness class this guide has already been caught by once.
  assert.match(ui, /stays up whenever RUSH is on offer/,
    "the guide's ⏩ RUSH entry must say the preview is there to read");

  // The persisted-field law reaches INSIDE settings too. The sibling check above
  // derives top-level coercions; a `save.settings.X` default is exactly as
  // load-bearing (a reset that leaves one undefined is the save.ach / save.stars
  // crash class), and the top-level regex cannot see it — `save.settings.aim =`
  // does not match `save.settings =`.
  const fresh = tdm.slice(tdm.indexOf("function freshSave("), tdm.indexOf("function resetProgress("));
  const nested = new Set();
  for (const line of tdm.split("\n")) {
    const m = /^\s*if \(.*\bsave\.settings\.([A-Za-z]+)\b.*\)\s*save\.settings\.\1 =/.exec(line);
    if (m) nested.add(m[1]);
  }
  assert.ok(nested.size >= 3,
    `the loader's settings coercions must be findable (found ${nested.size}: ${[...nested].join(", ")})`);
  for (const field of nested) {
    assert.ok(new RegExp("\\b" + field + ":").test(fresh),
      `save.settings.${field} is coerced at boot, so freshSave() must reset it too`);
  }
});

test("guardrail: throwing a live battle away has exactly ONE confirm owner", () => {
  const tdm = read("scripts/td-main.js").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

  // 🔁 Restart and 🏰 Back to the fort both discard a live board, and they
  // shipped with OPPOSITE policies — one asked, one did it on a single tap from
  // the row directly below ▶ Resume. Two adjacent siblings disagreeing about the
  // same rule is how hurriedMult got two writers and how the wake lock's acquire
  // and release drifted apart, so the confirm gets one owner and a second inline
  // UI.confirm cannot reintroduce a second policy.
  assert.equal((tdm.match(/UI\.confirm\(/g) || []).length, 1,
    "every 'are you sure' about a live battle goes through the one owner");
  assert.equal((tdm.match(/function promptDiscard\(/g) || []).length, 1,
    "…and that owner is defined exactly once");
  assert.ok(!/promptLeave/.test(tdm),
    "the previous owner must be GONE, not left beside the new one as a second path");

  // …and every destructive action in the pause menu routes through it. The list
  // is DERIVED from the handlers themselves — anything that restarts the level
  // or navigates away is destructive — so a third one inherits the rule instead
  // of needing this test edited (the "a scan's own list is part of the scan" law).
  const menu = tdm.slice(tdm.indexOf("function showPauseMenu("), tdm.indexOf("function showPauseMenu(") + 2000);
  const parts = menu.split(/\n\s{6}(?=\w+: )/).slice(1);
  const destructive = parts.filter((h) => /startLevel\(|location\.hash/.test(h));
  assert.ok(destructive.length >= 2,
    `the pause menu's destructive actions must be findable (found ${destructive.length})`);
  for (const h of destructive) {
    const name = (/^(\w+):/.exec(h) || [])[1];
    assert.match(h, /promptDiscard\(/,
      `the pause menu's "${name}" throws a live battle away, so it must ask first`);
  }
});

test("guardrail: \"which lanes, and which is lane 0\" has exactly ONE owner", () => {
  // Three consumers must agree: createEngine positions every enemy along lane 0,
  // laneCoverage measures a pad's `% road` against it, and propCells keeps the
  // scenery clear of it. It was three byte-identical copies of one ternary, and
  // a disagreement is not cosmetic — an enemy rendered on the wrong track is the
  // near-miss TD-7 already records.
  const eng = read("scripts/td-logic.js").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  assert.equal((eng.match(/function lanesOf\(/g) || []).length, 1, "lanesOf is defined exactly once");
  // Exactly ONE ternary, and it is the owner's own body — the first cut banned
  // it outright and flagged `lanesOf` itself, which is the scan matching the
  // thing it exists to protect.
  const terns = (eng.match(/levelDef\.paths && levelDef\.paths\.length \?/g) || []).length;
  assert.equal(terns, 1, `the lane-selection ternary must exist exactly once (saw ${terns})`);
  const at = eng.indexOf("function lanesOf(");
  const end = eng.indexOf("\n  function ", at + 10);
  assert.ok(at >= 0 && end > at, "the scan must find a real region to slice, not the rest of the file");
  assert.match(eng.slice(at, end), /levelDef\.paths && levelDef\.paths\.length \?/,
    "…and that one lives inside the owner, not at a call site");
  assert.ok((eng.match(/lanesOf\(levelDef\)/g) || []).length >= 3,
    "…and all three consumers read it");
});

test("guardrail: the fort-home blurb reads the roster OWNER, not its own numbers", () => {
  // The browser half proves the numbers are derived and that the rendered note
  // contains what UI.rosterBlurb() builds — but the note lives in the screen
  // SHELL, which is constructed once, so `includes(rosterBlurb())` is equally
  // true of a literal that happens to match today's roster. That is the half a
  // browser cannot distinguish, so it is pinned here.
  const ui = read("scripts/td-ui.js").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  assert.equal((ui.match(/UI\.rosterBlurb = function/g) || []).length, 1, "the blurb has exactly one owner");
  const note = ui.slice(ui.indexOf('<p class="td-note">'), ui.indexOf("👑 marks a boss finale"));
  assert.ok(note.length > 40 && note.length < 1200, "the scan must find a real region to slice, not the rest of the file");
  assert.match(note, /UI\.rosterBlurb\(\)/, "the note must ASK the owner rather than restate its numbers");
  // …and no count in that region may be a literal. Every number the blurb states
  // is derived from the data; a digit here is a number that will go stale, which
  // is precisely what the prose list it replaced did.
  // A STANDALONE number only: `tier-4 branches` is a tier's NAME, not a count,
  // and a digit bound into a word by a hyphen is never the thing that goes
  // stale. That distinction is the claim, not a fence around a residual.
  const digits = note.match(/(?<![\w-])\d+(?![\w-])/g) || [];
  assert.deepEqual(digits, [],
    `the blurb region must contain no literal counts — saw ${JSON.stringify(digits)}`);
  // …and every count it does state comes from the data or the owner.
  assert.ok((note.match(/global\.TDData/g) || []).length >= 4,
    "the levels, worlds, bosses and tower lines are all read from the data");
});

test("guardrail: a badge's description states the bar its award site enforces", () => {
  // 🌪️ Dyson Denied said only "Beat the Vacuum King" while the award site also
  // required `soldiersLost <= 3` — so a player who beat L8 and lost a fourth
  // army guy got nothing, having been told the requirement was just to win.
  // That is the 🛡️ No Leaks defect ("Win a level with all 20 lives" against a
  // `!leaked` check) with a different badge on it, and it survived because the
  // badge guardrails only ever asked whether a call site EXISTS.
  const DATA = require("../scripts/td-data.js");
  const main = read("scripts/td-main.js").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const dyson = DATA.ACHIEVEMENTS.find((a) => a.id === "dysondenied");
  assert.ok(dyson, "the badge is declared");
  assert.equal(typeof dyson.soldiers, "number",
    "the soldier bar belongs in the DATA beside the words that promise it, not as a literal at the award site");
  assert.ok(dyson.desc.includes(String(dyson.soldiers)),
    `the description must state the bar it enforces — "${dyson.desc}" never mentions ${dyson.soldiers}`);
  // …and the award site must READ it rather than restating it.
  assert.match(main, /cur\.soldiersLost <= achSoldierCap\(\)/,
    "the award site asks the one owner for the bar");
  assert.equal((main.match(/function achSoldierCap\(/g) || []).length, 1, "…which is defined exactly once");
  assert.ok(!/soldiersLost <= \d/.test(main),
    "no literal soldier bar may survive at the award site — that is how the words and the check drift apart");

  // The general half: no badge may describe itself with a number the code does
  // not own. Derived over every badge that declares a threshold field, so a
  // second gated badge inherits the rule.
  for (const a of DATA.ACHIEVEMENTS) {
    for (const [k, v] of Object.entries(a)) {
      if (typeof v !== "number") continue;
      assert.ok(a.desc.includes(String(v)),
        `badge "${a.id}" declares ${k}=${v} and its description never says so — a bar the player cannot read is a bar they cannot aim at`);
    }
  }
});

test("guardrail: a difficulty's player-facing NAME has exactly one owner", () => {
  const DATA = require("../scripts/td-data.js");
  const ids = Object.keys(DATA.DIFFICULTIES);
  assert.ok(ids.length >= 3, `the difficulties must be findable (found ${ids.length})`);
  // Every tier declares its own name, or a surface that reads it renders the raw
  // id — the dead-default class this repo has crashed on twice.
  for (const id of ids) {
    assert.ok(typeof DATA.DIFFICULTIES[id].label === "string" && DATA.DIFFICULTIES[id].label.length > 2,
      `difficulty "${id}" must declare a player-facing label`);
  }
  // …and that name lives in ONE place. It used to be a literal [id, name] list
  // inside the level grid, so the pause menu and the resume banner — which now
  // say which ladder a run is on — would have needed a second copy of the same
  // strings, which is how two owners of one string always start. The needles are
  // taken FROM the data, so a fourth tier is covered without editing this.
  // COMMENT-STRIPPED, like the sibling clause five lines below already was —
  // the two halves of this test disagreed, and the raw half matched its own
  // documentation the first time a code comment described the defect it exists
  // to prevent (a comment explaining that the chips used to concatenate to
  // "⚔️ Normal24/40" turned this red). Seventh recorded instance of "a scan must
  // not count its own documentation"; the law is about CODE having one owner,
  // and prose naming a label is documentation, not a second owner.
  const strip = (f) => read(f)
    .replace(/\/\*[\s\S]*?\*\//g, "")     // block comments
    .replace(/<!--[\s\S]*?-->/g, "")      // …and HTML ones, for index.html
    .replace(/^\s*\/\/.*$/gm, "");       // line comments, anchored so a URL survives
  // Every fort source EXCEPT td-data.js (the owner that declares the labels),
  // plus the markup. This was the FOURTH ban of this shape and the one I left
  // behind when the other three moved to TD_SOURCES an hour earlier — it omitted
  // td-logic.js, which is fix-it-where-you-found-it committed inside the fix for
  // fix-it-where-you-found-it. Measured clean there first.
  const files = [...TD_SOURCES.filter((f) => f !== "scripts/td-data.js"), "index.html"];
  for (const id of ids) {
    const label = DATA.DIFFICULTIES[id].label;
    for (const f of files) {
      assert.ok(!strip(f).includes(label),
        `"${label}" is the difficulty's own declared name — ${f} must read it from the data, not restate it`);
    }
  }
  // One reader, so the fallback for a label-less tier cannot drift either.
  const ui = read("scripts/td-ui.js").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  assert.equal((ui.match(/UI\.difficultyLabel = function/g) || []).length, 1,
    "one accessor owns the difficulty name");
  assert.ok(!/DIFFICULTIES\s*\|\|\s*\{\}\)\[[^\]]+\]\.label/.test(ui.replace(/UI\.difficultyLabel[\s\S]{0,300}/, "")),
    "nothing else reads a difficulty's label directly");
});

test("guardrail: 'how much of this wave is left' has ONE definition", () => {
  // The readout on the RUSH button and the rule that ENDS a wave are the same
  // quantity — bodies walking plus bodies still queued — so they share an owner.
  // Two copies is how a HUD comes to say "0 left" while the wave grinds on, and
  // it is the same class as `hurriedMult`'s two writers.
  const eng = read("scripts/td-logic.js")
    .replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  assert.equal((eng.match(/function bodiesLeft\(/g) || []).length, 1,
    "the wave's remaining-body count must have exactly one definition");
  assert.ok(/function finishIfWaveDone\(\)\s*\{\s*if \(bodiesLeft\(\)\)/.test(eng),
    "the wave-end rule must READ that owner, not re-derive the queue-and-alive test");
  assert.ok(/bodiesLeft: \(\) => bodiesLeft\(\)/.test(eng),
    "…and the engine must expose it, or the UI has to invent its own count");

  // The spawn queue is module-local ON PURPOSE (a mid-wave position is never
  // checkpointed), so nothing outside the engine can see the part of a wave that
  // has not spawned yet — which is most of it for the first seconds.
  assert.ok(!/state\.spawnQueue/.test(eng),
    "the spawn queue must stay off `state` — it is not checkpointed, and hashState would move");

  // The UI asks the engine rather than counting what it can see: `state.enemies`
  // alone understates every fresh wave, and this is the third instance of the
  // ask-the-engine law after the sell refund and the per-wave charge.
  const ui = read("scripts/td-ui.js")
    .replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  assert.ok(/bodiesLeft\(\)/.test(ui), "the wave readout must come from the engine");
  assert.ok(!/enemies\.filter\([^)]*alive[^)]*\)\.length/.test(ui),
    "the UI must not count live bodies itself — that silently drops everything still queued");
});

test("guardrail: every ARMED field control explains a refusal", () => {
  // The fort has controls you ARM and then aim by tapping the field: a power
  // (🧨 / 🍯 / ⚡ / 📌) and a camp's 🚩 rally flag. An aimed tap can miss — out of
  // range, no target, nothing to rally — and a refusal that says nothing is the
  // "dead control" defect this project fixed for abilities and then left in
  // place on rally for several releases, twenty lines away in the same handler.
  //   The region is NAMED because "which code arms a field tap" is not something
  // a text scan can derive honestly, but the property inside it is a COUNT
  // derived from the arm variables themselves — so a THIRD armed control is
  // caught without editing this test.
  const tdm = read("scripts/td-main.js")
    .replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const at = tdm.indexOf("function fieldTap(");
  assert.ok(at > 0, "the fieldTap region must be findable, or this scan is vacuous");
  // fieldTap is the LAST function at its indent, so a `\n  function ` bound
  // returns -1 and slice(at, -1) hands back the rest of the FILE — which is how
  // this scan first passed both its mutations: the rally branch borrowed a deny
  // cue from code hundreds of lines away. Bound on the closing brace instead,
  // and assert the region is a region.
  const close = tdm.slice(at).search(/\n {2}\}\n/);
  assert.ok(close > 0, "the fieldTap region must have a findable end");
  const body = tdm.slice(at, at + close);
  assert.ok(body.length < tdm.length / 2,
    `the fieldTap region must be a REGION, not most of the file (${body.length} chars)`);

  const arms = [...new Set([...body.matchAll(/cur\.(\w*ArmId)\b/g)].map((m) => m[1]))];
  assert.ok(arms.length >= 2,
    `fieldTap must arm at least the power and the rally (found ${arms.join(", ") || "none"})`);

  // PER BRANCH, not a total. A global count is satisfied by a NEIGHBOUR — the
  // lever's own deny cue lives in this same handler, so "at least one deny per
  // armed control" stayed green with rally's refusal stripped bare. Each branch
  // is bounded by the next one so it cannot borrow a sibling's cue either.
  const starts = arms
    .map((a) => ({ a, i: body.indexOf("if (cur." + a) }))
    .filter((x) => x.i >= 0)
    .sort((x, y) => x.i - y.i);
  assert.equal(starts.length, arms.length,
    `every armed control must open a branch of its own (found ${starts.length} of ${arms.length})`);
  starts.forEach((x, k) => {
    // Each branch ends at its OWN closing brace, never at the next branch or the
    // end of the region: the last one would otherwise swallow the lever's cue,
    // which is exactly the borrowing this test exists to prevent.
    const rel = body.slice(x.i).search(/\n {4}\}\n/);
    let end = rel > 0 ? x.i + rel + 6 : body.length;
    if (k + 1 < starts.length) end = Math.min(end, starts[k + 1].i);
    const chunk = body.slice(x.i, end);
    assert.ok(chunk.length < 4000,
      `${x.a}: its branch did not close, so this clause would borrow a sibling's cue`);
    assert.match(chunk, /sfx\("deny"\)/,
      `${x.a}: an armed control that refuses a tap must make a refusal SOUND`);
    // A NON-EMPTY hint: every one of these branches calls `UI.abilityHint("")`
    // on its success path to clear a stale message, so merely finding the call
    // proves nothing about the refusal — which is how this clause first survived
    // its own mutation. What the refusal SAYS is pinned behaviourally next door;
    // this half only guarantees the branch says something at all.
    assert.match(chunk, /UI\.abilityHint\(\s*(?!""\s*\))/,
      `${x.a}: …and must SAY WHY on the shared hint line, or the tap silently evaporates`);
  });
});

test("guardrail: a live navigation retries a socket reset, and NOTHING else", async () => {
  // verify-live is the only job that talks to a network nobody here controls, and
  // a CDN resets sockets: run #365 died on "Peer failed to perform TLS handshake"
  // in the two heaviest live tests, while `test` and `deploy` had both passed —
  // so the site was live and correct and the red said otherwise. A red
  // verify-live has to keep meaning "the deploy is broken".
  //   The danger of a retry is that it becomes a bug filter, so the interesting
  // clauses here are the ones about what must NOT be retried.
  const H = require("./helpers.js");
  const made = [];
  // The fixture carries its OWN hard cap. Without it an unbounded retry does not
  // fail this test, it HANGS — and a hang is not a proof, it is a stuck gate. The
  // cap turns a runaway into a distinctive rejection a clause can name.
  const RUNAWAY = 8;
  const fakePage = (fails, msg) => {
    let n = 0;
    return {
      goto: async () => {
        if (++n > RUNAWAY) throw new Error("RUNAWAY: retried past any sane bound");
        if (n <= fails) throw new Error(msg);
        return { ok: true, tries: n };
      },
      tries: () => n,
    };
  };
  const fakeBrowser = (page) => ({
    newPage: async () => { made.push("direct"); return page; },
    newContext: async () => ({ newPage: async () => { made.push("context"); return page; } }),
  });
  const RESET = "page.goto: Peer failed to perform TLS handshake: Error sending data: Connection reset by peer";

  // 1. a transient reset is retried and the run carries on
  let pg = fakePage(2, RESET);
  let b = H.withNavRetries(fakeBrowser(pg));
  let p = await b.newPage();
  const warn = console.warn; const said = []; console.warn = (m) => said.push(String(m));
  try {
    const res = await p.goto("https://example.test/");
    assert.ok(res && res.ok, "a socket reset that clears must not fail the run");
    assert.equal(pg.tries(), 3, "…and it must be the SAME navigation retried, not a new one");
  } finally { console.warn = warn; }
  assert.ok(said.length >= 2 && /retrying/.test(said[0]),
    "every retry must be announced — a silent retry hides a degrading network");

  // 2. bounded: a reset that never clears still fails, with the real error
  pg = fakePage(99, RESET);
  b = H.withNavRetries(fakeBrowser(pg));
  p = await b.newPage();
  console.warn = () => {};
  try {
    await assert.rejects(() => p.goto("https://example.test/"), /Connection reset/,
      "a site that is genuinely unreachable must still go red, saying why");
  } finally { console.warn = warn; }
  assert.ok(pg.tries() <= RUNAWAY,
    "an unbounded retry is a HANG, not a guard — this must stop on its own");
  assert.equal(pg.tries(), H.NAV_ATTEMPTS,
    `it must stop at exactly ${H.NAV_ATTEMPTS} attempts`);

  // 3. THE CLAUSE THAT MATTERS: a real failure is not retried at all. Masking a
  //    404, a timeout or a page error would turn this from a flake filter into a
  //    bug filter, which is far worse than the flake.
  for (const real of ["Timeout 30000ms exceeded", "net::ERR_ABORTED", "expected 3 to equal 4"]) {
    const rp = fakePage(99, real);
    const rb = H.withNavRetries(fakeBrowser(rp));
    const page = await rb.newPage();
    await assert.rejects(() => page.goto("https://example.test/"), new RegExp(real.split(" ")[0]));
    assert.equal(rp.tries(), 1, `"${real}" is a REAL failure and must fail on the first attempt`);
  }

  // 4. both ways a page is built inherit it — there are six such places across
  //    the suite, so wrapping the call sites would be a list someone forgets.
  const ctxPage = fakePage(1, RESET);
  const cb = H.withNavRetries(fakeBrowser(ctxPage));
  const viaCtx = await (await cb.newContext()).newPage();
  console.warn = () => {};
  try { await viaCtx.goto("https://example.test/"); } finally { console.warn = warn; }
  assert.equal(ctxPage.tries(), 2, "a page made through newContext() must retry too");
  assert.deepEqual(made.slice(-1), ["context"], "fixture: that page really came the context route");
});

test("a page that loads WITHOUT one of its scripts is retried, then named", async () => {
  // The sibling failure to a navigation that never connects, and the one that
  // actually cost a live run: `goto` resolves on `load`, so a `<script defer>`
  // whose fetch failed leaves the page booted and that file's globals simply
  // absent. Nothing throws, nothing is logged, and the suite reports the
  // DOWNSTREAM symptoms — five assertions saying 华丽 had 20 games instead of
  // 40, none of which named a script. Reproduced exactly by blocking
  // `games-hl-a.js`: her count drops to 20.
  //
  // Here the POLICY is driven with a fake page (does it retry, does it stop,
  // does it name the file); the DETECTION — that a script which never arrived
  // is actually noticed in a real DOM — is proven in e2e.test.js, because a
  // fake page cannot tell you whether the Resource Timing read works.
  // `H` is scoped to the test that declares it — the alias trap this file
  // already records for `const L = global.TDLogic` inside the guide function.
  const H = require("./helpers.js");
  // RUNAWAY is not decoration. This fake page's `goto` always SUCCEEDS, so if
  // the bound were ever removed the loop would spin for ever and this test
  // would HANG rather than fail — and a hang reads as broken infrastructure,
  // which is worse than a red. It turns that into a named failure.
  const RUNAWAY = 20;
  let n = 0;
  const fakePage = (badFor, missing) => ({
    goto: async () => {
      if (++n > RUNAWAY) throw new Error("RUNAWAY: retried past any sane bound");
      return { ok: true };
    },
    evaluate: async () => (n <= badFor ? missing : []),
  });
  const fakeBrowser = (page) => ({ newPage: async () => page, newContext: async () => ({ newPage: async () => page }) });
  const warn = console.warn; const said = [];

  // 1. A transient miss recovers, silently for the run and loudly in the log.
  n = 0;
  let p1 = await H.withNavRetries(fakeBrowser(fakePage(1, ["/scripts/games-hl-a.js"]))).newPage();
  console.warn = (m) => said.push(String(m));
  try {
    const res = await p1.goto("https://example.test/");
    assert.ok(res && res.ok, "a script that arrives on the retry must not fail the run");
  } finally { console.warn = warn; }
  assert.equal(n, 2, "…and it must be the SAME navigation retried");
  assert.ok(said.some((m) => /games-hl-a\.js/.test(m)),
    `the retry must NAME the file, or the log says nothing the five downstream assertions did not (${said.join(" | ")})`);

  // 2. Bounded, and the failure names the script rather than a symptom.
  n = 0;
  const p2 = await H.withNavRetries(fakeBrowser(fakePage(99, ["/scripts/games-hl-a.js"]))).newPage();
  console.warn = () => {};
  try {
    await assert.rejects(() => p2.goto("https://example.test/"), /did not run: \/scripts\/games-hl-a\.js/,
      "a script genuinely missing from the build must go red, saying WHICH");
  } finally { console.warn = warn; }
  // This pins an OUTCOME that TWO guards deliver — the loop's own cap and the
  // `break` — so removing either alone changes nothing and only removing BOTH
  // turns it red, which is what the RUNAWAY fixture converts from a hang into
  // this named failure. Measured, not implied.
  assert.ok(n <= RUNAWAY, "an unbounded retry is a HANG, not a guard — this must stop on its own");
  assert.equal(n, H.NAV_ATTEMPTS, `it must stop at exactly ${H.NAV_ATTEMPTS} attempts, not hang`);

  // 3. The control, and the reason this is not a false-positive machine: a page
  //    whose scripts all ran is not retried even once.
  n = 0;
  const p3 = await H.withNavRetries(fakeBrowser(fakePage(99, []))).newPage();
  const ok = await p3.goto("https://example.test/");
  assert.ok(ok && ok.ok, "a healthy page must pass straight through");
  assert.equal(n, 1, "a healthy page must not be navigated twice");

  // 4. A page with no `evaluate` at all (a closed context, or the fake pages the
  //    navigation-retry test uses) must be treated as "nothing to report" rather
  //    than as a missing script — otherwise this guard would fail every one of
  //    those, which is a false positive on the harness itself.
  n = 0;
  const p4 = await H.withNavRetries(fakeBrowser({ goto: async () => { n++; return { ok: true }; } })).newPage();
  const bare = await p4.goto("https://example.test/");
  assert.ok(bare && bare.ok, "a page that cannot be asked must not be failed");
  assert.equal(n, 1, "…and must not be retried");
});

test("guardrail: a badge announcement has ONE owner", () => {
  // Badges are announced by `announce()`, which routes by the run's PHASE — into
  // the outcome box when one is on screen, as a toast otherwise — because a toast
  // paints UNDER an overlay scrim and nearly every badge is earned at a win.
  //   `UI.toast` was a leftover one-line wrapper formatting the same string and
  // going straight to `UI.notice`, so it BYPASSED that routing. Nothing called
  // it, which is worse rather than better: it is the name a future author would
  // reach for, and reaching for it silently reinstates the defect of announcing
  // a badge behind the screen it was earned on.
  const files = TD_SOURCES;   // a ban belongs in every file the string could appear in
  const owners = [];
  for (const f of files) {
    const src = read(f).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    for (const _ of src.matchAll(/Badge earned!/g)) owners.push(f);
  }
  assert.equal(owners.length, 1,
    `the "Badge earned!" line must have exactly one owner (found in ${owners.join(", ") || "nowhere"})`);
  const ui = read("scripts/td-ui.js").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  assert.ok(!/UI\.toast\s*=/.test(ui),
    "UI.toast bypassed the phase routing and is gone — announce() is the only way to announce a badge");
});

test("guardrail: every event the engine emits reaches a consumer", () => {
  // The engine's event stream is the seam between a deterministic simulation and
  // everything the player can hear or see, and a type nobody listens to is a
  // moment that silently does not exist. Diffing the emit list against BOTH
  // dispatchers is what found the two that had none: `buycharge` (450 gold spent
  // with no cue at all, while every other purchase in the fort rings) and
  // `endless-wave` (the one number that mode is about, revealed only after the
  // run). DERIVED from the engine, so a new event type is covered here the day
  // it is written rather than the day someone remembers to edit this list.
  const eng = read("scripts/td-logic.js");
  const types = [...new Set(
    [...eng.matchAll(/emit\(\{\s*type:\s*"([a-z-]+)"/g)].map((m) => m[1]))].sort();
  assert.ok(types.length >= 20,
    `the emit scan must find the event types (saw ${types.length}) — a broken regex ` +
    "makes this whole check vacuous, and a derivation fails OPEN");

  // A consumer is a DISPATCH branch keyed on the type. It has to be that narrow:
  // a whole-file substring match is satisfied by a coincidence, and this one was
  // — deleting the `buycharge` branch left the check green because the string
  // still appeared in the sfx table as a CUE NAME. That is the same trap as the
  // precache scan matching a path inside a comment.
  //   Some types are legitimately owned by a surface that reads engine STATE, or
  // fires at the interaction instead, so each is named WITH its reason rather
  // than silently tolerated. (A consumer written as a `switch` rather than an
  // `e.type ===` chain would need to join this list too — with a reason.)
  const OWNED_ELSEWHERE = {
    won: "the victory screen is driven by phaseWatch reading state.phase",
    lost: "the defeat screen is driven by phaseWatch reading state.phase",
    lever: "the cue fires at the TAP site, synchronously — immediate feedback for a " +
      "press beats a round trip through the event queue; the route itself is drawn from state",
  };
  const consumers = read("scripts/td-main.js") + read("scripts/td-render.js");
  const orphans = types.filter((t) =>
    !OWNED_ELSEWHERE[t] && !new RegExp('e\\.type === "' + t + '"').test(consumers));
  assert.deepEqual(orphans, [],
    `these event types reach no sound and no fx, so the moments they mark are invisible: ${orphans.join(", ")}`);

  // …and the reverse: a reason that no longer applies is a stale exemption.
  for (const t of Object.keys(OWNED_ELSEWHERE)) {
    assert.ok(types.includes(t), `"${t}" is exempted here but the engine no longer emits it`);
  }
});

test("guardrail: 'beaten on this ladder' has ONE definition", () => {
  // The count under each difficulty chip and the grid's own unlock rule are the
  // same question asked twice — how many levels have you beaten on THIS ladder —
  // and a chip advertising a number the grid then contradicts is worse than no
  // number at all. Comment-stripped for the seventh recorded time, because the
  // comment beside the predicate necessarily writes its own name.
  const ui = read("scripts/td-ui.js")
    .replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  assert.equal((ui.match(/const beatenOn = /g) || []).length, 1,
    "'beaten on a ladder' must have exactly one definition");
  assert.ok((ui.match(/beatenOn\(/g) || []).length >= 2,
    "…and at least two consumers, or the extraction bought nothing");

  // POSITIVE form — assert what the unlock rule must BE, rather than enumerating
  // what everything else must not do, which is the false-positive machine this
  // project keeps refusing to ship.
  const at = ui.indexOf("UI.renderLevelGrid = function");
  assert.ok(at > 0, "the level grid must be findable, or this scan is vacuous");
  const body = ui.slice(at, ui.indexOf("\n  UI.", at + 40));
  assert.ok(/const unlocked = [^;]*beatenOn\(/.test(body),
    "the grid's unlock rule must read the shared predicate, not re-derive a star threshold");
  assert.ok(/UI\.ladderBeaten\(/.test(body),
    "…and the chip's count must read the shared owner too");
});

test("guardrail: every 'continue this run' start goes through the one rules owner", () => {
  const tdm = read("scripts/td-main.js").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  assert.equal((tdm.match(/function continueOpts\(/g) || []).length, 1,
    "the run's carried rules have exactly ONE owner");

  // Retry, retry-with-a-new-shuffle, restart and ▶ Next all CONTINUE a run, and
  // `startLevel` resolves `opts.difficulty || save.difficulty` — so a start that
  // forgets to say which run it is continuing silently inherits whatever the
  // fort home is set to now. That shipped: losing a heroic run and tapping Retry
  // handed back a casual one.
  //   The two regions ARE named, because "which code can see a live run" is not
  // something a text scan can derive honestly — but the property inside them is
  // a COUNT, so a fifth outcome button is caught without editing this test, and
  // each region is asserted to exist so a rename cannot make it vacuous. Note
  // `startDaily` is deliberately not counted: a daily's rules come from the
  // calendar, so re-deriving them is correct.
  for (const fn of ["phaseWatch", "showPauseMenu"]) {
    const at = tdm.indexOf("function " + fn + "(");
    assert.ok(at > 0, `the ${fn} region must be findable`);
    const end = tdm.indexOf("\n  function ", at + 10);
    const body = tdm.slice(at, end > 0 ? end : undefined);
    const starts = (body.match(/start(?:Level|Endless)\(/g) || []).length;
    const carried = (body.match(/continueOpts\(/g) || []).length;
    assert.ok(starts > 0, `${fn} must actually start levels, or this clause is vacuous (${starts})`);
    assert.equal(carried, starts,
      `${fn} starts ${starts} run(s) but carries the run's rules ${carried} time(s) — a continue that ` +
      "forgets inherits the fort home's difficulty and chips instead of the ones you were playing");
  }
});


test("guardrail: a pasted backup has ONE validator, shared by the preview and the write", () => {
  // 📥 Restore now PREVIEWS what is arriving so the confirm can name both sides.
  // That gives the same question two askers, and if they ever disagree the
  // dialog promises a restore the write refuses (or worse, confirms a blob the
  // write then half-applies). One predicate, two callers.
  const main = fs.readFileSync(path.join(root, "scripts/td-main.js"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const defs = (main.match(/function readSave\s*\(/g) || []).length;
  assert.equal(defs, 1, `readSave must be defined exactly once (saw ${defs})`);
  const calls = (main.match(/readSave\(/g) || []).length - defs;
  assert.equal(calls, 2, `exactly the preview and the write may read a pasted save (saw ${calls} call sites)`);
  // …and NEITHER may re-derive the check itself. `incoming.v !== 1` is the
  // shape test; it belongs to the validator alone.
  const owner = main.slice(main.indexOf("function readSave("));
  const ownerEnd = owner.indexOf("\n  }");
  const body = owner.slice(0, ownerEnd);
  const outside = main.replace(body, "");
  assert.ok(!/\.v !== 1/.test(outside),
    "the shape check must live in readSave alone — a second copy is how a preview and a write come apart");
  // Both consumers must exist, or the count above could be satisfied by one
  // function calling it twice.
  for (const hook of ["previewSave:", "importSave:"]) {
    assert.ok(main.indexOf(hook) >= 0, `td-main must still expose ${hook}`);
  }
});

test("guardrail: every defeat screen is handed the same three panels", () => {
  // showDefeat's head ternary rendered the post-mortem, the run summary AND the
  // earned-badge line only on the campaign side, and both non-campaign call
  // sites passed `null, null`. So endless and daily — modes that end ONLY in
  // defeat, i.e. this is the one outcome screen they have — showed a score and
  // nothing else, with no next level and no same-seed retry to learn from.
  //
  // The earned line made it a defect rather than a gap: announce() DEFERS while
  // the phase is won/lost, drainEarned() hands the list to showDefeat, and the
  // endless arm dropped it — so 🏃 Marathoner, the ONE badge whose only award
  // path is an endless run, was earned in silence. Quitting at wave 20+ DID
  // announce it (leavingPlay awards while the phase is not an outcome, so
  // announce toasts), which is the two-paths-disagree tell.
  //
  // The endless path is driven end to end in td.test.js. This is the half that
  // is not cheap to drive — a DAILY needs a pinned calendar AND a 20-wave board
  // — and it is the standing pairing: a scan proves the call site passes them,
  // the browser test proves the call does something.
  const m = read("scripts/td-main.js");
  const calls = (m.match(/UI\.showDefeat\(/g) || []).length;
  assert.ok(calls >= 3, `every run mode ends somewhere (found ${calls} showDefeat call sites)`);
  const panelled = (m.match(/postMortem\(\), runSummary\(/g) || []).length;
  assert.equal(panelled, calls,
    `every showDefeat call hands over the post-mortem AND the run summary (only ${panelled} of ${calls} do)`);
  // A `, null, null, drainEarned())` clause was written here and DELETED: it is
  // strictly dominated, because any call site shaped that way also drops the
  // panelled count above, so it can never fail on its own. Measured, not
  // assumed — a mutation adding a fourth nulled call site still reports
  // "only 3 of 4", never the null clause.
  // The 📖 button is rendered by the post-mortem block itself, and showDefeat's
  // click handler early-returns on a missing hook — so a call site that passes
  // a post-mortem without wiring `guide` renders a DEAD button, which is worse
  // than offering none. Sliced rather than counted file-wide because the pause
  // menu has a guide hook of its own; the bounds are asserted to BE a region,
  // since a bad slice hands back either the rest of the file or nothing.
  const lo = m.indexOf("UI.showDefeat("), hi = m.lastIndexOf("drainEarned())");
  assert.ok(lo > 0 && hi > lo && hi - lo < 4000,
    `the defeat call sites form one region (${lo}..${hi})`);
  const guides = (m.slice(lo, hi).match(/guide:/g) || []).length;
  assert.equal(guides, calls,
    `every defeat screen wires the 📖 hook (${guides} of ${calls}) — without it its own button is dead`);
});

test("what the game SAYS about a body has exactly one owner", () => {
  // Two surfaces describe an enemy now — the 📖 Guide's card and the field's
  // tap-to-inspect bubble — and a second copy of a derived string is exactly how
  // the tower panel came to print 110 while the engine charged 99, and how the
  // sell refund came to show 272 while sell() paid 306. So the stat line is
  // composed in ONE place (UI.enemyBrief) and both surfaces read it.
  //
  // The needle is the stat line's own signature rather than the word "bounty" or
  // a bare ❤️: ❤️ legitimately appears in the HUD's lives, the resume banner and
  // the guide's legend, and `reachedBy` has a second, CORRECT user in the defeat
  // post-mortem (whose own comment says it reads the matrix the way the guide
  // does). A scan that flagged those would be the false-positive machine this
  // repo refuses to ship.
  const strip = (f) => read(f).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const SIG = / · 🏃 /g;
  let total = 0, where = [];
  for (const f of TD_SOURCES) {
    const n = (strip(f).match(SIG) || []).length;
    total += n;
    if (n) where.push(f + " ×" + n);
  }
  // Comment-stripping is load-bearing here for the eighth recorded time: td-ui's
  // guide legend explains the format by quoting `❤️ 34 · 🏃 0.8 · 🪙 5`, so the
  // raw file scores 2 and a scan that counts its own documentation reports a
  // second owner that does not exist.
  assert.equal(total, 1,
    `the enemy stat line is composed in ${total} places (${where.join(", ") || "none"}) — ` +
    "it must have exactly one owner, or the field card and the guide will drift");
  // …and it must be the owner, not some other file that happens to build one.
  assert.match(strip("scripts/td-ui.js"), /UI\.enemyBrief\s*=\s*function/,
    "UI.enemyBrief is that owner and must exist");
  for (const f of TD_SOURCES.filter((f) => f !== "scripts/td-ui.js")) {
    assert.ok(!SIG.test(strip(f)),
      `${f} builds an enemy stat line of its own — read UI.enemyBrief instead`);
    SIG.lastIndex = 0;
  }
});

test("QoL: which power is armed has ONE owner", async () => {
  // Structural half of the pair: a scan proves the call sites cannot pass a
  // stale answer, and the behavioural test above proves the answer is right.
  const ui = read("scripts/td-ui.js"), main = read("scripts/td-main.js");
  const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const uiC = strip(ui), mainC = strip(main);

  assert.match(uiC, /UI\.abilities = function \(state\) \{/,
    "UI.abilities must take no armedId — it is what let UI.hud's own tail pass `undefined` " +
    "and strip the ring off a power that was still armed");
  assert.equal((mainC.match(/UI\.abilities\([^)]*,/g) || []).length, 0,
    "no call site may hand UI.abilities an armed id; it asks UI.armed() instead");
  assert.equal((mainC.match(/UI\.armed\s*=/g) || []).length, 1,
    "UI.armed must be injected exactly once — two writers is how this state drifted apart " +
    "in the first place");
  assert.match(uiC, /const armedId = UI\.armed \? UI\.armed\(\) : null;/,
    "the strip must ASK for the armed id rather than be told it");
});

test("Word Cards: the page ships, is reachable from Josh's home, and works offline", () => {
  // A flash-card game the OWNER supplied, kept as-is apart from this project's
  // documented platform floors (see the iOS laws below). Three wirings have to
  // hold together or the button is a dead end.
  assert.ok(fs.existsSync(path.join(root, "wordcards.html")), "wordcards.html is missing");

  const html = read("index.html");
  // (1) the control exists, in the home bar's third grid column (which was an
  //     empty spacer, so it costs no layout), and is CACHE-BUSTED like every
  //     other asset — the deploy rewrites __BUILD__ in index.html.
  const a = html.match(/<a[^>]*id="home-cards"[^>]*>/);
  assert.ok(a, "no #home-cards control in index.html");
  assert.match(a[0], /href="wordcards\.html\?v=__BUILD__"/,
    "the Word Cards link must point at the page AND carry ?v=__BUILD__, or a stale copy is served forever");
  assert.match(a[0], /aria-label="/, "the control needs an accessible name — its label is an emoji");

  // (2) PRECACHED. index.html requests it with ?v=<sha>; the SW stores the
  //     unversioned path and its ignoreSearch fallback resolves the query, which
  //     is the documented mechanism. Without this the button is dead offline —
  //     exactly how a car-ride PWA gets used.
  const core = JSON.parse(read("sw.js").match(/const CORE = (\[[^\]]*\])/)[1].replace(/,(\s*])/, "$1"));
  assert.ok(core.includes("./wordcards.html"), "wordcards.html is not precached — the button dies offline");
});

test("every shipped PAGE obeys the iOS 14.2 floors", () => {
  // The CSS floors already guarded styles/*.css; a page with an INLINE <style>
  // is a stylesheet nothing was scanning. Same class as "a stylesheet-scoped
  // guardrail only guards that stylesheet", one file type over.
  assert.ok(PAGES.includes("index.html") && PAGES.length >= 2,
    `PAGES looks wrong (${PAGES.join(", ")}) — the derivation failed OPEN and every clause below is vacuous`);
  for (const f of PAGES) {
    // Comment-stripped, for the EIGHTH recorded time in this repo: this scan
    // reads raw source, and a page whose comment legitimately QUOTES the rule
    // it obeys ("never user-scalable=no") makes the law fire on working code.
    // Strip HTML and CSS comments; `//` is left alone because a URL is not a
    // comment in either language.
    const src = read(f).replace(/<!--[\s\S]*?-->/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
    const css = [...src.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join("\n");

    // Safari 14 has NO flex gap, and on this page gap IS the only spacing, so
    // the controls would touch on Josh's actual iPad. grid gap DOES work there.
    for (const m of css.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
      const body = m[2];
      if (!GAP_DECL.test(body)) continue;
      const disp = (body.match(/display\s*:\s*([\w-]+)/) || [])[1] || "";
      assert.notEqual(disp, "flex",
        `${f}: "${m[1].trim()}" spaces with flex gap, which Safari 14.0 DROPS — use a grid`);
    }
    // A dvh line must be PAIRED with a vh fallback (14.0 drops the dvh one).
    for (const m of css.matchAll(/([\w-]+)\s*:\s*[^;]*dvh[^;]*;/g)) {
      const before = css.slice(0, m.index);
      assert.match(before, new RegExp(m[1] + "\\s*:\\s*[^;]*vh[^;]*;\\s*$"),
        `${f}: "${m[0].trim()}" has no same-property vh fallback immediately before it`);
    }
    assert.doesNotMatch(css, /(^|[;\s{])inset\s*:/, `${f}: the "inset:" shorthand is dropped by Safari 14 — use longhands`);
    // Stopping the ACCIDENTAL double-tap zoom is right; banning zoom is not.
    assert.doesNotMatch(src, /user-scalable\s*=\s*no/,
      `${f}: user-scalable=no removes pinch-zoom for low-vision users, and iOS has ignored it since iOS 10`);
    assert.doesNotMatch(src, /maximum-scale\s*=\s*1/, `${f}: maximum-scale=1 blocks zooming`);
  }
});

test("every shipped PAGE carries the app's touch hygiene", () => {
  // These laws lived in styles/main.css, which a STANDALONE page does not load.
  // Word Cards is the first such page and it arrived with none of them — on the
  // most tap-dense surface in the app, where you tap the card, then Next, then
  // Next, fast, with a four-year-old's hands.
  //
  // The population is PAGES and the source is pageCss(), i.e. what the page
  // ACTUALLY loads — so index.html passes because main.css carries these, and a
  // standalone page passes because its own <style> does. One mechanism, no
  // exemption for either. Comment-stripped: a page that quotes the rule it
  // obeys must not fire the law (this repo's most-repeated own goal).
  assert.ok(PAGES.length >= 2, `PAGES looks wrong (${PAGES.join(", ")}) — every clause below is vacuous`);
  let checked = 0;
  for (const f of PAGES) {
    const src = read(f).replace(/<!--[\s\S]*?-->/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
    const css = pageCss(f).replace(/\/\*[\s\S]*?\*\//g, "");
    // `[^{}]+\{[^{}]*\}` skips at-rule wrappers naturally and yields the inner rules.
    const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => [m[1].trim(), m[2]]);
    assert.ok(rules.length > 5, `${f}: found only ${rules.length} CSS rules — the scan failed OPEN`);
    const onRoot = (re) => rules.some(([sel, body]) =>
      sel.split(",").some((one) => /^(html|body|:root|\*)$/.test(one.trim())) && re.test(body));

    // (1) The double-tap zoom the owner reported from real play. `touch-action`
    //     INTERSECTS down the ancestor chain, so one root declaration covers the
    //     whole page — including the GAPS between controls, which is exactly
    //     where a fumbled second tap lands. It cannot ban pinch-zoom.
    assert.ok(onRoot(/touch-action\s*:\s*manipulation/),
      `${f}: nothing on html/body declares touch-action: manipulation, so a fumbled double-tap zooms the page and is hard to undo (reported from real play). Never fix this with user-scalable, which iOS ignores and which bans zooming for low-vision users.`);

    // (2) The other half: rubber-band, pull-to-refresh (which RELOADS mid-play
    //     and loses your place) and scroll chaining out of an inner scroller.
    assert.ok(onRoot(/overscroll-behavior\s*:\s*none/),
      `${f}: nothing on html/body declares overscroll-behavior: none — a drag past the top rubber-bands, and pull-to-refresh can reload the page mid-play`);
    for (const [sel, body] of rules) {
      if (!/overflow-y\s*:\s*(auto|scroll)/.test(body)) continue;
      assert.match(body, /overscroll-behavior\s*:\s*contain/,
        `${f}: "${sel}" scrolls internally, so it must contain its own overscroll — otherwise reaching its end hands the rest of the gesture to the page behind it`);
    }

    // (3) PAIRING LAW, and this one caught a regression I introduced: adding
    //     `viewport-fit=cover` to match the repo's convention extends the layout
    //     UNDER the notch and the home indicator, so consuming the insets is not
    //     optional — it is the other half of that flag. Word Cards shipped with a
    //     26px bottom pad against a ~34px home indicator, so its ◀ ▶ row sat
    //     under it. Same shape as the dvh/vh pairing above.
    if (/viewport-fit\s*=\s*cover/.test(src)) {
      assert.match(css, /env\(\s*safe-area-inset-/,
        `${f}: declares viewport-fit=cover, which pushes the layout under the notch and the home indicator, but consumes no env(safe-area-inset-*) — so content sits under them`);
    }

    // (4) The long-press callout bubble is the other half of "touch and hold
    //     highlights it as if it were text", so a page that suppresses selection
    //     must suppress the callout too, or it fixed half the report.
    if (/[^-]user-select\s*:\s*none/.test(css)) {
      assert.match(css, /-webkit-touch-callout\s*:\s*none/,
        `${f}: suppresses text selection but not the long-press callout bubble — the two halves of one reported defect`);
    }
    // (5) …and a real text field keeps every default, or the iOS paste menu is
    //     gone from the only places the app wants one (the fort's 💾 Backup box
    //     and the type-the-word reset gates). VACUOUS on a page with no field —
    //     said plainly rather than implying it guards something here.
    if (/<(input|textarea)\b/.test(src) && /[^-]user-select\s*:\s*none/.test(css)) {
      assert.match(css, /user-select\s*:\s*text/,
        `${f}: has a text field but no rule restoring user-select: text — losing the caret and the paste menu there is worse than the bug the blanket none fixes`);
    }
    assert.match(css, /-webkit-tap-highlight-color/, `${f}: no -webkit-tap-highlight-color — iOS paints a grey box on every tap`);
    checked += 1;
  }
  assert.equal(checked, PAGES.length, `only ${checked} of ${PAGES.length} pages were audited`);
});

test("Word Cards states no card count it has to keep up to date", () => {
  // The deck shipped with `"n": 80` per category and a literal "500 cards".
  // Both go stale the moment a card is added or removed — this repo's most
  // repeated defect class, in miniature. Every count is derived from WORDS.
  const src = read("wordcards.html");
  const markup = src.slice(0, src.indexOf("<script>"));
  assert.doesNotMatch(markup, /\d+\s*cards/, "a literal card count is a claim that goes stale");
  assert.doesNotMatch(src, /"n":\s*\d+/, "the per-category counts must not be stored, they must be counted");
  assert.match(src, /WORDS\.length \+ " cards"/, "the total must be read off WORDS");
  assert.match(src, /list\.length\s*\+\s*' cards/, "each category count must be read off WORDS");
});
