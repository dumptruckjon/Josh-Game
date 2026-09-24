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

// A JS source's STRING LITERALS — the text that can actually reach a screen.
// Two laws below need this, and both need it for the same reason: a comment is
// never inside a string literal, so reading literals makes a scan comment-immune
// BY CONSTRUCTION rather than stripping comments for the tenth recorded time.
// One owner, because two definitions of "what is a string here" is the class
// this repo keeps paying for. It bails on a newline inside a quoted string
// rather than swallowing the rest of the file, so an unterminated literal
// degrades instead of blinding the scan.
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

// What CSS a page loads, as chunks in CASCADE (document) order, each keeping
// its own file and line offset. It used to be two loops — every inline <style>
// first, then every <link> — which is the right SET and the wrong ORDER, and
// was correct only because no page happens to interleave the two. A law about
// which of two rules WINS cannot rest on that coincidence.
const pageSheets = (f) => {
  const src = fs.readFileSync(path.join(root, f), "utf8");
  const out = [];
  for (const m of src.matchAll(/<style[^>]*>([\s\S]*?)<\/style>|<link[^>]+rel="stylesheet"[^>]+href="([^"?]+)/g)) {
    if (m[1] != null) {
      out.push({ file: f, css: m[1], line0: src.slice(0, m.index + m[0].indexOf(">") + 1).split("\n").length - 1 });
    } else if (fs.existsSync(path.join(root, m[2]))) {
      out.push({ file: m[2], css: fs.readFileSync(path.join(root, m[2]), "utf8"), line0: 0 });
    }
  }
  return out;
};
const pageCss = (f) => pageSheets(f).map((c) => c.css).join("\n");
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

// Relative luminance of an OPAQUE colour; null for anything that composites.
// Module scope because THREE laws below weigh a colour, and three copies of
// this is how one of them goes blind to `rgba(...)` while the others catch it.
const lum = (css) => {
  if (/gradient\(/i.test(css)) return null; // no single lightness to compare
  const hex = css.match(/#([0-9a-f]{3}|[0-9a-f]{6})\b/i);
  const rgb = css.match(/rgba?\(([^)]+)\)/i);
  let c;
  if (hex) {
    let h = hex[1];
    if (h.length === 3) h = h.split("").map((x) => x + x).join("");
    c = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  } else if (rgb) {
    const p = rgb[1].split(/[\s,/]+/).filter(Boolean).map(Number);
    if (p.length >= 4 && p[3] < 0.999) return null;
    c = p.slice(0, 3);
  } else return null;
  if (c.some((v) => !Number.isFinite(v))) return null;
  const f = (v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
};
const contrast = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

// A STATE is a class the app ADDS OR REMOVES at runtime, so one element wears
// it and then does not and the viewer has to tell those apart. A VARIANT is
// baked into the markup at creation -- `.tile--surprise`, the three
// `.start-tile--*` world doors -- and is a different OBJECT with its own icon
// and label, which holding to a state law is the fence this repo keeps
// refusing. The difference is derivable rather than a judgement: grep what the
// scripts actually toggle. Entries carry the leading dot.
const RUNTIME = new Set();
for (const f of [...SCRIPTS, ...PAGES]) {
  const src = read(f);
  for (const m of src.matchAll(/classList\s*\.\s*(?:add|remove|toggle)\(([^)]*)\)/g))
    for (const c of m[1].matchAll(/["'`]([A-Za-z][\w-]*)["'`]/g)) RUNTIME.add("." + c[1]);
  for (const m of src.matchAll(/\bclassName\s*=\s*[^;]*\?\s*["'`]\s*([\w-]+)/g)) RUNTIME.add("." + m[1]);
}

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
  // …and the population is EVERY shipped page, not index.html alone. That was
  // complete only by accident: wordcards.html shipped for months with every
  // asset inline, so a scan of index.html happened to cover the whole app — and
  // went blind the moment a second page linked anything of its own. Same class
  // as the VS16 scan's nine hand-listed files and the flex-gap law guarding one
  // stylesheet, which is why the file list is derived here too.
  const linked = new Set();
  for (const f of PAGES) {
    const hits = [...read(f).matchAll(/(?:href|src)="(?!https?:|#|data:|\/\/)([^"?]+)/g)]
      .map((m) => m[1].replace(/^\.\//, "")).filter((u) => u && !u.startsWith("#"));
    assert.ok(hits.length >= 1, `${f} links nothing at all — the page-asset scan cannot be right`);
    for (const u of hits) linked.add(u);
  }
  assert.ok(linked.size >= 25, `the page-asset scan must find the links (saw ${linked.size})`);
  for (const u of [...linked, ...PAGES]) {
    assert.ok(core.includes(u), `SW CORE is missing ${u} — offline it 404s to the HTML fallback and the app boots as a dead shell`);
  }
  // …and the derivation must still cover what the hand list covered.
  for (const s of [...SCRIPTS, "styles/main.css", "styles/td.css", "scripts/hanzi-strokes.js"]) {
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

test("guardrail: a TURN is one message — a reply is heard in full, and only the child interrupts", async () => {
  // MEASURED 2026-09: say() cancelled before EVERY line, so a line followed by
  // another in the same synchronous turn never made a sound. Driving all 240
  // games with a speechSynthesis stub that models cancel found 594 lines killed
  // in the very turn that spoke them, in 192 games — the sorter's "It floats —
  // it's light and traps air." under the next round's prompt, "The opposite of
  // happy is sad!", every roundWin({say}) restatement before newRound() — and 49
  // more cut short mid-sentence by the game's OWN round-advance timer. Every
  // capture-the-strings test stayed green: a line PASSED to say() and a line
  // HEARD are different things. This drives the real audio.js against a stub
  // that records what reaches the engine, so each rule is proven on its own.
  const vm = require("node:vm");
  const log = [];
  const listeners = {};
  const synth = {
    cancel() { log.push("cancel"); },
    speak(u) { log.push((u.lang ? "[" + u.lang + "] " : "") + u.text); },
  };
  function Utterance(t) { this.text = t; this.lang = ""; }
  const box = {
    localStorage: { getItem: () => "0", setItem() {} }, // sound ON
    speechSynthesis: synth, SpeechSynthesisUtterance: Utterance,
    addEventListener(type, fn, capture) { if (capture) listeners[type] = fn; },
    setTimeout, clearTimeout, queueMicrotask, Promise,
  };
  vm.createContext(box);
  vm.runInContext(read("scripts/audio.js"), box);
  const A = box.JoshAudio;
  const endOfTurn = () => new Promise((r) => setTimeout(r, 0)); // microtasks + the input flag's reset
  const tap = () => listeners.click();                          // what a real click's capture phase does
  const take = () => log.splice(0, log.length);

  assert.equal(typeof listeners.click, "function", "audio.js must watch INPUT events (capture phase) to tell a tap from a timer");
  for (const t of ["pointerdown", "keydown"]) assert.equal(typeof listeners[t], "function", `audio.js must also treat ${t} as the child acting`);

  // 1. A reply is ONE message: feedback, then the next question, both heard.
  tap();
  A.say("It floats — it's light and traps air.");
  A.say("Will it sink or float?");
  await endOfTurn();
  assert.deepEqual(take(), ["cancel", "It floats — it's light and traps air.", "Will it sink or float?"],
    "a line said in the same turn as another must be QUEUED behind it, never cancel it");

  // 1b. One tap can be answered by two listeners — two TURNS, because a real
  //     click runs a microtask checkpoint after each — and the second must not
  //     cut the first: a tap interrupts old speech once.
  tap();
  A.say("Hooray!");
  await Promise.resolve(); await Promise.resolve(); // the first listener's turn ends; same input event
  A.say("You found it!");
  await endOfTurn();
  assert.deepEqual(take(), ["cancel", "Hooray!", "You found it!"], "a tap must interrupt old speech ONCE, not once per listener");

  // 2. No line silently replaces another: a question and its target word are
  //    BOTH heard (the "give way" refinement dropped the question from 16 games).
  tap();
  A.say("What sound does it start with?");
  A.say("moon");
  await endOfTurn();
  assert.deepEqual(take(), ["cancel", "What sound does it start with?", "moon"],
    "no line may silently replace another said earlier in the same turn");

  // 3. The same words twice in one turn are said once — however punctuated…
  tap();
  A.say("Simon says: touch the hand!");
  A.say("Simon says, touch the hand!");
  A.say("Which letter is missing?");
  A.say("Which letter is missing from the train?");
  await endOfTurn();
  assert.deepEqual(take(), ["cancel", "Simon says: touch the hand!", "Which letter is missing?", "Which letter is missing from the train?"],
    "the same words twice in one turn must be said once — and different words must not be merged");

  // 4. The game's own TIMER never talks over what is still being said…
  A.say("That's an island — land with water all around!");
  await endOfTurn();
  A.say("Make a Lake! Tap the middle.");
  await endOfTurn();
  assert.deepEqual(take(), ["That's an island — land with water all around!", "Make a Lake! Tap the middle."],
    "a turn that did not start from INPUT must queue behind the speech still playing, not cancel it");

  // 5. …but the CHILD always can: a new tap interrupts whatever is still playing —
  //    and "the same words once" is per TURN, so a line may come back next tap.
  tap();
  A.say("Try again!");
  await endOfTurn();
  tap();
  A.say("Try again!");
  await endOfTurn();
  assert.deepEqual(take(), ["cancel", "Try again!", "cancel", "Try again!"],
    "a turn that starts from the child's input must interrupt old speech, and a line may be said again in a later turn");

  // 6. Each line keeps its own language, queued or not — and Chinese is compared
  //    as words too (its full-width punctuation is not a different sentence).
  tap();
  A.say("对！是兔！", { lang: "zh-CN" });
  A.say("对，是兔。", { lang: "zh-CN" });
  A.say("哪一个是生肖？", { lang: "zh-CN" });
  await endOfTurn();
  assert.deepEqual(take(), ["cancel", "[zh-CN] 对！是兔！", "[zh-CN] 哪一个是生肖？"],
    "a queued line keeps its language, and Chinese is compared as WORDS (a key that strips it to nothing merges every line)");

  // 7. Muted is silent, whatever the turn.
  A.setMuted(true);
  tap(); A.say("anything"); A.say("at all");
  await endOfTurn();
  assert.deepEqual(take(), [], "sound OFF must stay silent");

  assert.equal(typeof A.lineKey, "function", "JoshAudio must export lineKey — the ONE owner of 'these are the same words', which the e2e walk compares through");
  // …and nothing but audio.js (plus the router's navigation cancel) may drive
  // the speech engine, or a script can cancel its own reply again.
  for (const f of SCRIPTS) {
    if (f === "scripts/audio.js") continue;
    const src = read(f).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    const uses = src.match(/speechSynthesis\.(speak|cancel)\(/g) || [];
    const allowed = f === "scripts/main.js" ? 1 : 0;
    assert.ok(uses.length <= allowed,
      `${f} calls speechSynthesis directly ${uses.length}x — speak through JoshAudio.say, the ONE owner of speech turns`);
  }
});

test("guardrail: a round SPEAKS one line — setPrompt carries it, never speak() then say()", () => {
  // Found with the speech-turn fix (2026-09). While say() cancelled before every
  // line only the LAST line of a turn was ever heard, so 87 call sites in 87
  // games had been written `setPrompt(q); speak(); say(q2)` — 73 of them saying
  // a specific question after a generic one, 14 saying the SAME words twice.
  // Once a turn's lines are queued, that says the question twice. The rule now:
  // a round's one spoken line is setPrompt's 3rd argument (`spoken`), which is
  // also exactly what 👂 "hear it again" replays. The dedupe in audio.js merges a
  // literal repeat at runtime, but code that relies on it cannot be read, so the
  // idiom itself is banned. ONE exception is named with its reason, and it must
  // still exist — an allowance nothing uses is how a carve-out rots into a hole.
  const ALLOW = {
    "hl-menu": "记菜单 says the menu once, and the menu must NOT be what 👂 repeats during recall, or the memory game answers itself",
  };
  const games = SCRIPTS.filter((f) => /^scripts\/games-.*\.js$/.test(f));
  assert.ok(games.length >= 10, `the scan must find the game scripts (saw ${games.length})`);
  const hits = {};
  for (const f of games) {
    const src = read(f);
    // speak() then say(), with only whitespace or // comment lines between.
    for (const m of src.matchAll(/api\.speak\(\);(?:\s|\/\/[^\n]*\n)*api\.say\(/g)) {
      const ids = [...src.slice(0, m.index).matchAll(/\bid:\s*"([^"]+)"/g)];
      const id = ids.length ? ids[ids.length - 1][1] : "?";
      const line = src.slice(0, m.index).split("\n").length;
      (hits[id] = hits[id] || []).push(`${f}:${line}`);
    }
  }
  const bad = Object.entries(hits).filter(([id]) => !ALLOW[id]);
  assert.deepEqual(bad, [],
    `a game says TWO lines where it means one — setPrompt(caption, icons, spoken) then speak(), never speak() then say(): ${bad.map(([id, at]) => id + " @ " + at.join(",")).join(" | ")}`);
  for (const id of Object.keys(ALLOW)) {
    assert.ok(hits[id], `the allowance for "${id}" no longer matches any code — delete it rather than leave a dead exception`);
  }
});

test("guardrail: every answer is a CLICK — the one event the hammer's echo guard hears", () => {
  // framework.js swallows a finger's ECHO (the second tap a four-year-old makes
  // for every tap he means) in ONE capture-phase `click` listener on the game
  // screen — see ECHO_MS. That protects every game only while every game
  // ANSWERS on click: a game that answered on pointerdown or touchstart would
  // take the echo straight past the guard, and the four rules would be dead
  // code for it. The one pointer listener a game may carry is the one-shot audio
  // WARM-UP (iOS will not play until a gesture has resumed the context), which
  // answers nothing. Derived from the page's own game scripts, so a new games
  // file is covered the day it is loaded.
  const games = SCRIPTS.filter((f) => /^scripts\/games-.*\.js$/.test(f));
  assert.ok(games.length >= 10, `the scan must find the game scripts (saw ${games.length})`);
  const EVENT = /(?:pointer|touch|mouse)(?:down|up|start|end|move|over|out|enter|leave|cancel)/;
  const WARM = /^addEventListener\("pointerdown", function warm\(\) \{ if \((?:A && )?A\.unlock\) A\.unlock\(\); \w+\.removeEventListener\("pointerdown", warm\); \}, \{ once: true \}\)/;
  const bad = [];
  let warm = 0;
  for (const f of games) {
    const src = read(f).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    for (const m of src.matchAll(new RegExp(`addEventListener\\(\\s*["'](${EVENT.source})["']`, "g"))) {
      if (WARM.test(src.slice(m.index))) { warm += 1; continue; }
      bad.push(`${f}:${src.slice(0, m.index).split("\n").length} listens for "${m[1]}"`);
    }
    // el()'s props turn `onpointerdown: fn` into a listener too
    for (const m of src.matchAll(new RegExp(`\\bon(${EVENT.source})\\s*[:=]`, "g"))) {
      bad.push(`${f}:${src.slice(0, m.index).split("\n").length} sets on${m[1]}`);
    }
  }
  assert.deepEqual(bad, [],
    "a game answers on an event the echo guard never sees — answer on `click` (framework.js catches the hammer's echo there):\n" + bad.join("\n"));
  assert.ok(warm >= 3, `the scan must recognise the audio warm-up listeners it exempts (saw ${warm}) — or it is matching nothing`);
});

test("guardrail: the app's two echo guards agree on what a finger is", () => {
  // Josh's games are guarded by framework.js; Word Cards, which loads no
  // framework, carries its own. Two copies of one definition drift — within a
  // day of shipping, the page exempted keyboard activations and the framework
  // did not. They are held to ONE window and the same two exemptions: a
  // synthetic click (isTrusted) and a keyboard activation (detail 0) are never a
  // finger's echo.
  const fw = read("scripts/framework.js").replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, "");
  const wc = read("wordcards.html").replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*|<!--[\s\S]*?-->/g, "");
  const ms = (src) => { const m = src.match(/ECHO_MS\s*=\s*(\d+)/); return m && +m[1]; };
  assert.ok(ms(fw) > 0 && ms(wc) > 0, "both guards declare ECHO_MS");
  assert.equal(ms(wc), ms(fw), "Word Cards and the framework must use the SAME echo window");
  // …and the page's rule 2 ("an echo that lands on another SCREEN") must know
  // every screen. It read "#menu, #deck, #write, #match", a list the listening
  // game would have had to join; every screen is a .wrap, so it asks that.
  assert.match(wc, /closest\("\.wrap"\)/,
    "wordcards.html: the echo guard's screen must be DERIVED (every screen is a .wrap), never a list of ids");
  assert.doesNotMatch(wc, /closest\("#menu, #deck/, "wordcards.html: the hand-written screen list is back");
  for (const [name, src] of [["framework.js", fw], ["wordcards.html", wc]]) {
    assert.match(src, /isTrusted/, `${name}: a synthetic click is code, never a finger — the guard must check isTrusted`);
    assert.match(src, /\.detail\s*(?:===|!==)\s*0/, `${name}: a keyboard activation (detail 0) is deliberate — the guard must exempt it`);
  }
});

test("guardrail: a round ends through api.nextRound — never a game's own timer", () => {
  // MEASURED 2026-09: 39 timers in the game files ended a round — they called
  // newRound(), api.roundWin() or api.win() a beat after the answer — and
  // through that beat the answered board stayed live: 23 games said "try
  // again" to a deliberate tap on it, 15 left the winning answer flagged for
  // the harness, and 🏠 inside the beat either ran the next round on a hidden
  // screen (a raw setTimeout) or stranded him on the answered board when he came
  // back (an api.later, which navigation cancels and nothing re-ran).
  // framework.js now owns a round's end: api.nextRound(fn, ms) closes the board
  // and survives navigation, and api.win({ after }) is a win after a beat,
  // recorded at the tap. This pins the other half: no game's own timer —
  // setTimeout or api.later, an inline callback or a named function it resolves
  // to — may end a round. A handler the timer only REGISTERS (Who Hid?'s line-up
  // builds chips whose clicks end the round) runs on the child's tap, not the
  // timer's, so it is not the timer ending anything. Derived from the page's own
  // game scripts; the browser half (e2e) proves the behaviour on every game.
  const games = SCRIPTS.filter((f) => /^scripts\/games-.*\.js$/.test(f));
  assert.ok(games.length >= 10, `the scan must find the game scripts (saw ${games.length})`);
  const ENDS = /\bnewRound\s*\(|\bapi\.(?:roundWin|win)\s*\(/;
  // comments and string contents blanked, every offset kept (so a brace or a
  // "newRound(" inside a string or a comment can never count)
  const mask = (src) => {
    let out = "", i = 0;
    while (i < src.length) {
      const c = src[i], d = src[i + 1];
      if (c === "/" && d === "/") { while (i < src.length && src[i] !== "\n") { out += " "; i++; } continue; }
      if (c === "/" && d === "*") { while (i < src.length && !(src[i] === "*" && src[i + 1] === "/")) { out += src[i] === "\n" ? "\n" : " "; i++; } out += "  "; i += 2; continue; }
      if (c === '"' || c === "'" || c === "`") {
        out += c; i++;
        while (i < src.length && src[i] !== c) { if (src[i] === "\\") { out += "  "; i += 2; continue; } out += src[i] === "\n" ? "\n" : "_"; i++; }
        out += c; i++; continue;
      }
      out += c; i++;
    }
    return out;
  };
  const shut = (s, open) => { // index of the bracket that closes s[open]
    let depth = 0;
    for (let i = open; i < s.length; i++) {
      if (s[i] === "(" || s[i] === "{") depth++;
      else if (s[i] === ")" || s[i] === "}") { depth--; if (depth === 0) return i; }
    }
    return s.length;
  };
  const handlersOut = (s) => { // blank every handler the timer merely registers
    let out = s;
    for (const m of s.matchAll(/addEventListener\(/g)) {
      const o = m.index + m[0].length - 1, c = shut(s, o);
      out = out.slice(0, o) + " ".repeat(c - o + 1) + out.slice(c + 1);
    }
    return out;
  };
  const bad = [];
  let timers = 0, named = 0, registers = 0;
  for (const f of games) {
    const raw = read(f), s = mask(raw);
    const blocks = [...s.matchAll(/(?:\bF\.register|\breg)\(/g)].map((m) => { const o = m.index + m[0].length - 1; return [o, shut(s, o)]; });
    for (const m of s.matchAll(/\b(setTimeout|api\.later)\(/g)) {
      timers += 1;
      const open = m.index + m[0].length - 1, args = s.slice(open + 1, shut(s, open));
      const at = `${f}:${raw.slice(0, m.index).split("\n").length}`;
      const id = /^\s*([A-Za-z_$][\w$]*)\s*,/.exec(args);
      let body = args;
      if (id) {
        named += 1;
        if (id[1] === "newRound") { bad.push(`${at} ${m[1]}(newRound, …)`); continue; }
        // a named callback resolves inside its OWN game (many games share names)
        const blk = blocks.find(([a, b]) => a < m.index && m.index < b);
        const scope = blk ? s.slice(blk[0], blk[1]) : s;
        const fm = new RegExp("\\bfunction\\s+" + id[1].replace(/\$/g, "\\$") + "\\s*\\(").exec(scope);
        if (!fm) continue;
        const fo = scope.indexOf("{", fm.index);
        body = scope.slice(fo, shut(scope, fo) + 1);
      }
      if (ENDS.test(handlersOut(body))) bad.push(`${at} ${raw.slice(m.index, m.index + 80).replace(/\s+/g, " ")}`);
      else if (ENDS.test(body)) registers += 1;
    }
  }
  assert.deepEqual(bad, [],
    "a game's own timer ends a round, so the answered board stays live through the beat — end it with api.nextRound(fn, ms), or a win after a beat with api.win({ after: ms }):\n" + bad.join("\n"));
  assert.ok(timers >= 20, `the scan must find the games' timers (saw ${timers}) — or it is matching nothing`);
  assert.ok(named >= 2, `the scan must resolve NAMED timer callbacks too (saw ${named})`);
  // the carve-out must still match real code, or it is a hole nobody can see
  assert.ok(registers >= 1, "the scan must still meet a timer that only REGISTERS a round-ending handler (Who Hid?'s line-up) — or the exemption guards nothing");
});

test("guardrail: [hidden] has ONE owner, and it beats every display rule", () => {
  // The UA's [hidden]{display:none} is an author-overridable DEFAULT, so any
  // class that sets `display` silently UN-HIDES an element a game hid:
  // `.choices` (grid) kept Who Hid?'s and Mix It!'s previous-round chips on
  // screen — the old correct one still flagged, so a tap during the next
  // round's line-up counted a round nobody had asked — `.hl-grid3` showed
  // 记菜单's dishes while she was memorising the menu, and `.truck__lever`
  // showed a dead DUMP lever from the start. Fourteen per-class `.x[hidden]`
  // patches had covered the classes somebody noticed. This pins the ONE rule
  // that makes [hidden] mean hidden; the browser half (e2e: every game at open
  // and at its win, every nav screen, the fort) proves no hidden element has a
  // box.
  const strip = (c) => c.replace(/\/\*[\s\S]*?\*\//g, "");
  const main = strip(read("styles/main.css"));
  const m = main.match(/(^|[}\s])\[hidden\]\s*\{\s*display:\s*none\s*!important;?\s*\}/);
  assert.ok(m, "main.css must declare `[hidden] { display: none !important; }` — without !important, any later `display` rule beats it");
  const upTo = main.slice(0, m.index + m[1].length);
  assert.equal((upTo.match(/\{/g) || []).length - (upTo.match(/\}/g) || []).length, 0,
    "the [hidden] rule must be TOP-LEVEL — inside a media query it would only hold at some sizes");
  // …and it is the only one. A per-class `.x[hidden] { display: none }` is how
  // the defect survived: it fixes the class somebody noticed and leaves every
  // other class that sets `display` exactly as broken.
  const patches = [];
  for (const [sheet, raw] of SHEETS) {
    for (const r of strip(raw).matchAll(/([^{}@;]+)\{([^{}]*)\}/g)) {
      const sels = r[1].split(",").map((x) => x.trim());
      if (sels.some((x) => /[^\s(,]\[hidden\]/.test(x)) && /display:\s*none/.test(r[2])) patches.push(sheet + ": " + r[1].trim());
    }
  }
  assert.deepEqual(patches, [], "the global rule owns [hidden] — a per-class patch is redundant and is how this defect hid: " + patches.join(" | "));
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
  // Hidden screens are covered by the ONE global [hidden] rule now (it used to
  // be a `.screen[hidden]` patch — see the [hidden] guardrail): assert the
  // property, not the class it was first patched on.
  assert.ok(/(^|[\s}])\[hidden\] \{ display: none !important/.test(css),
    "hidden screens must stay display:none !important so the game-screen flex rule can't reveal them — the global [hidden] rule owns this");
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
test("guardrail: no two STATES of one element are told apart by COLOUR alone", () => {
  // 配对's three tile states were separated by hue on the FILL and nothing else
  // (held #FFC93C is L=0.634 and done #B7E4C7 is L=0.697 — 1.09:1, the same
  // lightness), and the browser test that pins THAT surface can only ever pin
  // that surface. This is the derived half: it walks every stylesheet this app
  // ships and asks the same question of every state pair, so a sixth
  // concentration game or a new game's state cue inherits it.
  //
  // It found the one other instance in the app: `.memory-card.flipped` (#fff)
  // against `.memory-card.matched` (#d7f8de) is 1.14:1 with identical shadow,
  // outline, opacity and ink — and a found pair and your live pick are BOTH
  // face-up showing their emoji, so on the hue channel they were one state.
  // Five games share that surface. Its two siblings already had it right:
  // `.order__item--done` (ring + opacity) and 华丽's `.hl-card--done`
  // (fill + border-colour + opacity).
  //
  // A WORLD THEME is not a state: `.tile__label`, `.topbar` and `.screen .game`
  // are each restyled under `hl-mode`, and the two worlds are never on screen
  // together, so nobody ever has to tell them apart. That exclusion cannot fail
  // on today's data (`.hl-sudoku .sudoku__cell` would join its Josh-world twin
  // at 1.02:1, held out by a `border`) and is kept because it is one declaration
  // from firing on correct code. A GRADIENT is weighed at its stops (best pair);
  // a TRANSLUCENT fill composites over whatever is behind it and has no
  // lightness to read — those are the pairs tests/state-cues.js classifies.
  //
  // WHAT COUNTS AS "SOMETHING OTHER THAN COLOUR". The first version kept ONE
  // list of "structural" properties, and it held `color`, `border-color`,
  // `stroke` and `background-image` beside `box-shadow` and `opacity` — so a
  // state that changed ONLY colours (fill + text colour + border colour) was
  // excused as structural, which is the exact defect this law is named for.
  // Measured, fifteen pairs were excused that way. They are two KINDS now. A
  // SHAPE property (a ring's geometry, opacity, a transform, size, whether it is
  // shown) separates two states whatever their colours. A COLOUR property
  // separates them only when its two values differ in LUMINANCE by 3:1, because
  // luminance is what survives when hue does not. Size was missing from the
  // list altogether — Coin Mix-Up's nickel is 102px against the penny's 76, and
  // that, not its text colour, is what tells them apart.
  //
  // THE BAR IS NOT INVENTED. A state cue carried by fill IS a graphical object
  // required to understand the content, so it owes WCAG 1.4.11's 3:1 — the same
  // bar the memory card's own new ring was measured against (#2c7a3f on the
  // mint reads 4.64:1; the #3fae61 I reached for first measured 2.47 and was
  // rejected by that measurement). Both endpoints sit clear of it: the defect
  // is 1.14:1 and the nearest CORRECT pair — 写字's written stroke #21123F
  // against its finished #2C7A3F — is 3.24:1, i.e. a character completing gets
  // visibly LIGHTER rather than merely greener.
  const FILL = /(?:^|;)\s*(background(?:-color)?|fill)\s*:\s*([^;]+)/gi;
  const STRUCT =
    /(?:^|;)\s*(box-shadow|border(?:-[a-z-]+)?|outline(?:-[a-z-]+)?|opacity|transform|filter|text-decoration(?:-[a-z]+)?|stroke(?:-width|-dasharray)?|font-weight|font-size|clip-path|background-image|color|width|height|min-width|min-height|max-width|max-height|display|visibility)\s*:\s*([^;]+)/gi;
  // Every value splits into a SHAPE (its colours replaced by a token) and its
  // COLOURS. `inherit`/`currentcolor`/`transparent` are colour tokens with no
  // lightness of their own, so they can never BE a cue — the conservative way.
  const COLOUR_TOKEN = /#[0-9a-f]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)|\b(?:transparent|currentcolor|inherit|initial|unset|white|black)\b/gi;
  const NAMED = { white: "#ffffff", black: "#000000" };
  const shapeOf = (v) => v.replace(COLOUR_TOKEN, "C").replace(/\s+/g, " ").trim();
  // A `border`/`outline` shorthand carries a width, a style AND a colour, so it
  // is split: otherwise a state's `border-color` is compared against nothing
  // instead of against the colour the base's shorthand actually paints.
  const expand = (struct) => {
    const out = {};
    for (const [prop, v] of Object.entries(struct)) {
      const m = prop.match(/^(border|outline)(-(?:top|right|bottom|left))?$/);
      if (!m) { out[prop] = v; continue; }
      const colour = (v.match(COLOUR_TOKEN) || [])[0];
      out[prop + "-width-style"] = shapeOf(v.replace(COLOUR_TOKEN, ""));
      if (colour) out[m[1] + (m[2] || "") + "-color"] = colour;
    }
    return out;
  };
  const grab = (decls, re) => {
    const out = {};
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(decls))) out[m[1].toLowerCase()] = m[2].trim();
    return out;
  };

  assert.ok(RUNTIME.size >= 40, `the runtime-class scan must find classes (saw ${RUNTIME.size})`);

  const groups = new Map();
  for (const [file, css0] of SHEETS) {
    const css = css0.replace(/\/\*[\s\S]*?\*\//g, "");
    const re = /([^{}@][^{}]*)\{([^{}]*)\}/g;
    let m;
    while ((m = re.exec(css))) {
      const sels = m[1].trim().replace(/\s+/g, " ");
      if (!sels || sels.startsWith("@")) continue;
      for (const sel of sels.split(",").map((x) => x.trim()).filter(Boolean)) {
        const last = sel.split(/[\s>+~]+/).pop();
        if (!last || last[0] !== ".") continue;
        const t = last.match(/^(\.[A-Za-z][\w-]*)(.*)$/);
        if (!t) continue;
        const [, base, rest] = t;
        if (rest && /^:(hover|focus|active|focus-visible|before|after|first|last|nth|not|root|is|where|any-link|visited)/.test(rest)) continue;
        const bem = base.match(/^(\.[\w-]+?)--([\w-]+)$/);
        const key = bem ? bem[1] : base;
        const state = bem ? "--" + bem[2] + rest : rest || "(base)";
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push({ file, sel, state, cls: base + rest, decls: m[2] });
      }
    }
  }

  // A custom property is DOCUMENT-scoped: wordcards.html defines its own
  // `--card: #FFC93C` (and rewrites it per card at runtime), so resolving every
  // sheet against one shared :root makes that page's token overwrite main.css's
  // and the number downstream describes a colour from another document — which
  // is exactly what the ring law next door reported on its first run. Per file,
  // falling back to main.css only for the sheets that share index.html with it.
  const varsOf = new Map();
  for (const [file, css0] of SHEETS) {
    const v = {};
    for (const rm of css0.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/:root\s*\{([^{}]*)\}/g))
      for (const m of rm[1].matchAll(/(--[\w-]+)\s*:\s*([^;]+)/g)) v[m[1]] = m[2].trim();
    varsOf.set(file, v);
  }
  const deref = (value, file) => {
    const own = varsOf.get(file) || {};
    const shared = /\.html$/.test(file) ? {} : varsOf.get("styles/main.css") || {};
    let o = value, n = 0;
    while (/var\(/.test(o) && n++ < 5)
      o = o.replace(/var\(\s*(--[\w-]+)\s*(?:,\s*([^)]*))?\)/g, (_, k, d) => own[k] || shared[k] || d || "");
    return o.trim();
  };
  const stopsOf = (v) =>
    (/gradient\(/.test(v) ? [...v.matchAll(/#[0-9a-f]{3,8}\b|rgba?\([^)]*\)/gi)].map((x) => x[0]) : [v])
      .map(lum).filter((x) => x != null);
  // A viewer may use ANY part of the element, so two fills are distinguishable
  // if SOME corresponding position differs — the BEST pair, not the worst.
  // Same-length stop lists zip by position (a top against a top); otherwise
  // every combination is allowed, which is the generous reading and can only
  // ever flag LESS.
  const bestPair = (x, y) => (x.length && y.length
    ? Math.max(...(x.length === y.length ? x.map((v, i) => [v, y[i]]) : x.flatMap((v) => y.map((w) => [v, w])))
        .map(([v, w]) => contrast(v, w)))
    : null);

  const coloursOf = (v, file) => [...deref(v, file).matchAll(COLOUR_TOKEN)]
    .map((x) => lum(NAMED[x[0].toLowerCase()] || x[0])).filter((x) => x != null);
  // Is anything BUT hue telling these two effective maps apart?
  const cueBetween = (ea, eb, fileA, fileB) => {
    for (const k of new Set([...Object.keys(ea), ...Object.keys(eb)])) {
      const va = ea[k] || "", vb = eb[k] || "";
      if (va === vb) continue;
      const sa = shapeOf(deref(va, fileA)), sb = shapeOf(deref(vb, fileB));
      if (sa !== sb) {
        // A lone colour against NOTHING is a colour weighed against an unknown
        // (inherited) value — not a cue, and not a shape either.
        if ((sa === "" && sb === "C") || (sb === "" && sa === "C")) continue;
        return true;                                   // the SHAPE differs
      }
      const cr = bestPair(coloursOf(va, fileA), coloursOf(vb, fileB));
      if (cr != null && cr >= 3) return true;        // a LUMINANCE cue
    }
    return false;
  };

  // A state may carry its second channel on a DESCENDANT rather than on the
  // element itself. That IS visible in the CSS, so it is derived rather than
  // excused: any rule that uses the state class as an ancestor and declares a
  // SHAPE property counts. A descendant that only changes a colour does not —
  // there is no base value beside it to weigh that colour against.
  const descendantRules = [];
  for (const [, rs] of groups) for (const r of rs) descendantRules.push(r);
  const descendantCue = (cls) => {
    if (!cls) return false;
    return descendantRules.some((r) => {
      const i = r.sel.indexOf(cls);
      if (i < 0) return false;
      const after = r.sel.slice(i + cls.length);
      if (!/^[\s>+~]/.test(after)) return false;      // an ancestor, not the element itself
      return Object.values(expand(grab(r.decls, STRUCT))).some((v) => shapeOf(deref(v, r.file)) !== "C");
    });
  };
  // The one channel a stylesheet CANNOT see is CONTENT. These states replace
  // what is INSIDE the element — Peekaboo swaps the closed door for the friend
  // behind it, a tic-tac-toe cell gets its X or O, This Goes With That's "?"
  // becomes the answer's picture, and the fort's ▶ CALL relabels itself ⏩ RUSH
  // — so the colour is the backdrop to the cue, not the cue. Named, with the
  // game, rather than guessed at from a line-window heuristic over the scripts;
  // the clause below keeps each honest by requiring it to still exist.
  const CONTENT_CUE = [".peek--open", ".ttt__cell--set", ".gw__cell--filled", ".td-call--rush"];
  // A price button is painted affordable-or-not BEFORE it is shown — pinned by
  // td.test.js's "UX: a price is the ENGINE's, and its colour is right on the
  // FIRST paint" — so its bare base never renders, and a pair against it is a
  // phantom. The pair that DOES render, `.td-afford` against `.td-afford--no`,
  // is still weighed.
  const PAINTED_BEFORE_SHOWN = [".td-afford", ".td-afford--no"];
  const TRANSLUCENT = require("./state-cues.js");

  const bad = [];
  const unreadable = [];
  let pairs = 0, judged = 0;
  for (const [base, rs] of groups) {
    const states = rs
      .map((r) => ({ ...r, fill: grab(r.decls, FILL), struct: expand(grab(r.decls, STRUCT)) }))
      .filter((s) => s.fill.background || s.fill["background-color"] || s.fill.fill);
    if (states.length < 2) continue;
    for (let i = 0; i < states.length; i++) {
      for (let j = i + 1; j < states.length; j++) {
        const a = states[i], b = states[j];
        const fa = a.fill.background || a.fill["background-color"] || a.fill.fill;
        const fb = b.fill.background || b.fill["background-color"] || b.fill.fill;
        if (fa === fb) continue;
        pairs++;
        if (/hl-|--hl/.test(a.sel) || /hl-|--hl/.test(b.sel)) continue; // a world, not a state
        // Test the FULL class, never the suffix. `.memory-card.matched` groups
        // with state ".matched", which a runtime class matches — but a BEM
        // modifier groups with state "--open", and no runtime entry can ever be
        // a substring of that. So EVERY `--modifier` in the app read as a
        // variant and was skipped, which is why this law only ever judged the
        // compound-class handful: 19 pairs of 124. Reading `cls` takes it to 44.
        const isState = (x) => x.state === "(base)" || [...RUNTIME].some((c) => (x.cls || x.state).includes(c));
        if (!isState(a) || !isState(b)) continue; // a variant, not a state
        if (CONTENT_CUE.includes(a.cls) || CONTENT_CUE.includes(b.cls)) continue;
        if ((a.state === "(base)" && PAINTED_BEFORE_SHOWN.includes(b.state)) ||
            (b.state === "(base)" && PAINTED_BEFORE_SHOWN.includes(a.state))) continue;
        // Two BASE rules of one class are two SCOPES, not two states, unless
        // what separates them is itself a runtime class: `.scene__zone` and
        // `.hide__wrap .scene__zone` are one class in two different games.
        if (a.state === "(base)" && b.state === "(base)") {
          const scopeIsState = (x) => (x.sel.split(/[\s>+~]+/).slice(0, -1).join(" ").match(/\.[\w-]+/g) || [])
            .some((c) => RUNTIME.has(c));
          if (!scopeIsState(a) && !scopeIsState(b)) continue;
        }
        const cr = bestPair(stopsOf(deref(fa, a.file)), stopsOf(deref(fb, b.file)));
        // The base's declarations are INHERITED by a modifier on the same
        // element, so a modifier that simply does not re-declare `box-shadow`
        // is not structurally different from the base — comparing the two
        // rules' own declarations treated it as if it were, and excused any
        // state that merely adds a colour to a card that has a shadow.
        const baseStruct = (states.find((x) => x.state === "(base)") || { struct: {} }).struct;
        const ea = { ...baseStruct, ...a.struct }, eb = { ...baseStruct, ...b.struct };
        // …and a cue may be scoped to a DESCENDANT: `.villain--webbed` carries
        // grayscale, opacity and a scale on its inner guy plus a web overlay,
        // none of which lives on the element this law groups by. Computed
        // BEFORE the translucency check, because a real cue excuses a pair
        // whatever its fills are — a ring does not stop being a ring over glass.
        const cue = cueBetween(ea, eb, a.file, b.file) || descendantCue(a.cls) || descendantCue(b.cls);
        if (cr == null) {                // a TRANSLUCENT side: no lightness to read
          if (!cue) unreadable.push(`${base} ${a.state} vs ${b.state}`);
          continue;
        }
        judged++;
        if (cue) continue;
        if (cr < 3)
          bad.push(`${base} ${a.state} vs ${b.state} — ${fa} / ${fb} is ${cr.toFixed(2)}:1 and nothing but hue differs [${a.file}]`);
      }
    }
  }
  // The residue — translucent, and nothing else to go on — must be CLASSIFIED
  // in tests/state-cues.js, both ways: a new pair is red until somebody says
  // what carries it, and an entry whose pair has gone is red too, or it becomes
  // a dead carve-out a future class of the same name slips through.
  assert.deepEqual([...new Set(unreadable)].sort(), Object.keys(TRANSLUCENT).sort(),
    "translucent state pairs with nothing but hue to go on must each be classified in tests/state-cues.js");
  // Each named CONTENT exemption must still EXIST, or a removed game leaves a
  // dead carve-out that a future class of the same name slips through.
  for (const c of [...CONTENT_CUE, ...PAINTED_BEFORE_SHOWN])
    assert.ok([...groups.values()].some((rs) => rs.some((r) => r.cls === c)),
      `${c} is exempted as a content-cued state but no longer exists — drop the exemption rather than leaving it open`);

  // A derivation fails OPEN, and the exclusions above shrink the population, so
  // the floors guard the scan itself rather than the product. MEASURED, and the
  // breakdown overturned my own estimate twice over. Reading gradients and
  // var() was worth only 4 pairs, not the ~100 I guessed, because the colour
  // step was never the main filter. What WAS the main filter was a bug: of 124
  // fill-differing pairs, 64 scored as VARIANTS — every `--modifier` in the
  // app — so this law had been judging 15. Fixed, it judged 42 — and then 37,
  // because six of those 42 were comparisons against DEAD duplicate rules:
  // `.coin` was declared by two games, so the law was weighing Coin Mix-Up's
  // penny against Piggy Bank's penny (1.01:1) as if they were two states of
  // one coin. Deleting the dead copies (see "WHOLLY DEAD" below) removed them.
  // The pairs still unreadable all have a TRANSLUCENT side, which genuinely
  // composites over whatever is behind it; resolving those needs a browser.
  //
  // The judged floor is what pins the widening, and it has had to move twice
  // because what counts as JUDGED changed, not the product. The dead-code
  // cleanup took 42 to 37; classifying the phantom price bases and the two
  // new content cues took seven more pairs that were never real comparisons.
  // MEASURED on this tree: the suffix bug judges 13 and the fixed law 30, so
  // 21 is the midpoint — nine clear of healthy and eight clear of the defect,
  // where the old bars each sat two pairs from healthy and would have failed
  // for a non-defect. (The suffix bug ALSO trips the residue assertion above:
  // with `--on` read as a variant, the drum pair drops out of it.) Blind
  // the rule-matching regex above and the first floor reports `saw 0` — which
  // is the only reason this scan cannot pass by finding nothing.
  assert.ok(pairs >= 25, `the state-pair scan must find pairs to judge (saw ${pairs})`);
  assert.ok(judged >= 21, `the exclusions must not swallow the scan (judged ${judged} of ${pairs})`);
  assert.deepEqual(bad, [], "a state told apart by colour alone:\n" + bad.join("\n"));
});

test("guardrail: a state RING is a box-shadow, never an `outline` (iOS 14.2 squares it)", () => {
  // `outline` does NOT follow `border-radius` until a Safari well above Josh's
  // iOS 14.2 floor, and the exact version is not answerable from this sandbox
  // (both doc sources came back EGRESS_BLOCKED when the memory card's own ring
  // raised it). So the rule is the one that needs no version: `box-shadow`
  // follows the radius on every engine we ship to. It matters because on his
  // iPad a 5px outline inset into a 22px-rounded card draws a SQUARE whose
  // corners float free of the card — and nothing in this sandbox can show it,
  // because Chromium rounds the outline correctly.
  //
  // The :focus-visible carve-out is NOT hypothetical and is load-bearing: the
  // browser draws a focus ring itself and rounds it, and Word Cards uses six
  // of them. Measured before this comment was written, because a comment that
  // claims an exemption is vacuous cannot go red when it stops being true.
  const offenders = [];
  let focusRings = 0, scanned = 0;
  for (const [file, css0] of SHEETS) {
    const css = css0.replace(/\/\*[\s\S]*?\*\//g, "");
    const re = /([^{}@][^{}]*)\{([^{}]*)\}/g;
    let m;
    while ((m = re.exec(css))) {
      const sels = m[1].trim().replace(/\s+/g, " ");
      if (!sels || sels.startsWith("@")) continue;
      const decl = m[2].match(/(?:^|;)\s*outline\s*:\s*([^;]+)/i);
      if (!decl) continue;
      scanned++;
      if (/^\s*(none|0)\b/i.test(decl[1])) continue;        // removing one is fine
      if (/:focus(-visible)?\b/.test(sels)) { focusRings++; continue; }
      offenders.push(`${sels} { outline: ${decl[1].trim()} } [${file}]`);
    }
  }
  assert.ok(scanned >= 8, `the outline scan must find outline declarations (saw ${scanned})`);
  assert.ok(focusRings >= 5, `the :focus carve-out must still be load-bearing (saw ${focusRings} focus rings)`);
  assert.deepEqual(offenders, [], "a coloured `outline` draws a SQUARE ring on Josh's iPad — use box-shadow:\n" + offenders.join("\n"));
});

test("guardrail: a state RING must be visible against the surface it rings (WCAG 1.4.11)", () => {
  // A ring that marks a state IS "visual information required to identify a
  // state", so it owes 3:1 — the same published bar the memory card's fill was
  // held to, not an invented threshold. Measured on the shipped defects:
  // #7be08a is 1.63:1 on a white card and 1.48:1 on a .choice, i.e. a pale mint
  // band that a screenshot shows reading as a tint rather than a marker;
  // #2c7a3f (写字's finished-stroke green, already audited) is 5.30 / 4.80.
  //
  // PER DOCUMENT, never over SHEETS: a custom property and a class name are
  // both document-scoped, and wordcards.html defines its own `--card: #FFC93C`
  // (it even rewrites it per card at runtime). Resolving every sheet against
  // one shared `:root` made that page's token overwrite main.css's, so the
  // first run of this law reported `.more__panel--win — #7be08a on #FFC93C`,
  // a surface that element never sits on. The tell was that the number was
  // about a colour from another document entirely. What the PAGES loop buys is
  // that ISOLATION, not a second population: wordcards.html has no ring-only
  // state of its own today (its rings change the fill too, and the rest are
  // :focus-visible, which the law above owns), so walking index.html alone
  // measures the same result. Say which half is doing the work.
  //
  // COVERAGE LIMIT, stated rather than implied: the surface is resolved from
  // the CSS, and five rings sit on one the CSS cannot know — set INLINE per
  // round (.cbn__swatch), inherited from the stage (.word__slot, .ml__slot,
  // .tenf__cell), or added by a script to an element it never names in a class
  // string (.held). Those are SKIPPED, not excused; the floor below is what
  // stops the scan passing by resolving nothing at all.
  const RINGK = /^(box-shadow|border-color|outline|outline-color)$/;
  const FILLK = /^(background|background-color|fill)$/;
  const props = (decls, re) => {
    const o = {};
    for (const m of decls.matchAll(/(?:^|;)\s*([a-z-]+)\s*:\s*([^;]+)/gi)) { const k = m[1].toLowerCase(); if (re.test(k)) o[k] = m[2].trim(); }
    return o;
  };
  const coloursIn = (v) => [...v.matchAll(/#[0-9a-f]{3,8}\b|rgba?\([^)]*\)/gi)].map((x) => x[0]);
  // A ring may be SELF-CONTRASTING: two bands, dark beside light — the fort's
  // own dark-under-bright law written in CSS. That is the only honest answer
  // for a cell whose surface VARIES (.cg__cell--win rings a toggle cell that is
  // either the pale card or the lit purple), and it needs no exemption:
  // whichever surface it lands on, one band contrasts with it. Measured, a
  // single colour cannot do that job here with any margin — only a near-pure
  // black clears both, at 3.03:1 against the lit cell.
  const selfContrasting = (cols) => {
    const ls = cols.map(lum).filter((x) => x != null);
    return ls.some((a) => ls.some((b) => contrast(a, b) >= 3));
  };

  const faint = [];
  let judged = 0;
  for (const page of PAGES) {
    // every CSS source THIS document loads, kept separate so a message can name
    // the file, and every script it runs, for the co-class map below.
    const src = read(page);
    const sources = [[page, [...src.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join("\n")]];
    for (const m of src.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"?]+)/g))
      if (fs.existsSync(path.join(root, m[1]))) sources.push([m[1], read(m[1])]);
    const js = [...src.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
    for (const m of src.matchAll(/<script[^>]+src="([^"?]+)/g))
      if (fs.existsSync(path.join(root, m[1]))) js.push(read(m[1]));

    const vars = {}, rules = [];
    for (const [file, css0] of sources) {
      const css = css0.replace(/\/\*[\s\S]*?\*\//g, "");
      for (const rm of css.matchAll(/:root\s*\{([^{}]*)\}/g))
        for (const m of rm[1].matchAll(/(--[\w-]+)\s*:\s*([^;]+)/g)) vars[m[1]] = m[2].trim();
      const re = /([^{}@][^{}]*)\{([^{}]*)\}/g;
      let m;
      while ((m = re.exec(css))) {
        const sels = m[1].trim().replace(/\s+/g, " ");
        if (!sels || sels.startsWith("@")) continue;
        for (const sel of sels.split(",").map((x) => x.trim()).filter(Boolean)) rules.push({ file, sel, decls: m[2] });
      }
    }
    const deref = (v) => { let o = v, n = 0; while (/var\(/.test(o) && n++ < 5) o = o.replace(/var\(\s*(--[\w-]+)\s*(?:,\s*([^)]*))?\)/g, (_, k, d) => vars[k] || d || ""); return o.trim(); };
    // A simple class's own background, and the classes this document's scripts
    // put beside it (`class: "choice order__item tap"` is how .order__item gets
    // its surface).
    const bg = new Map(), co = new Map();
    for (const r of rules) {
      const last = r.sel.split(/[\s>+~]+/).pop();
      if (!last || last[0] !== "." || /[:\[]/.test(last)) continue;
      const f = props(r.decls, FILLK);
      const v = f.background || f["background-color"] || f.fill;
      if (v && !bg.has(last)) bg.set(last, deref(v));
    }
    for (const source of js)
      for (const m of source.matchAll(/class:\s*["'`]([^"'`]+)["'`]/g)) {
        const cs = m[1].trim().split(/\s+/).filter((x) => /^[\w-]+$/.test(x));
        for (const a of cs) { if (!co.has(a)) co.set(a, new Set()); for (const b of cs) if (b !== a) co.get(a).add(b); }
      }
    const surfaceOf = (cls) => {
      if (bg.has("." + cls)) return bg.get("." + cls);
      const bem = cls.match(/^([\w-]+?)--[\w-]+$/);
      const base = bem ? bem[1] : cls;
      if (bg.has("." + base)) return bg.get("." + base);
      for (const c of co.get(base) || []) if (bg.has("." + c)) return bg.get("." + c);
      return null;
    };
    // the WORST stop of a gradient, so a two-stop card is judged at its lighter end
    const worst = (ring, surf) => {
      const lr = lum(ring);
      if (lr == null) return null;
      const stops = /gradient\(/.test(surf) ? coloursIn(surf) : [surf];
      const ls = stops.map(lum).filter((x) => x != null);
      return ls.length ? Math.min(...ls.map((x) => contrast(lr, x))) : null;
    };

    for (const r of rules) {
      const ring = props(r.decls, RINGK);
      if (!Object.keys(ring).length) continue;
      if (Object.keys(props(r.decls, FILLK)).length) continue;  // the fill is a second channel
      const last = r.sel.split(/[\s>+~]+/).pop();
      if (!last || last[0] !== "." || /:(hover|focus|active|focus-visible)/.test(last)) continue;
      const cls = last.replace(/[:\[].*$/, "").split(".").filter(Boolean).pop();
      if (!RUNTIME.has("." + cls)) continue;                    // a variant, not a state
      const surf = surfaceOf(cls);
      if (surf == null) continue;                               // see COVERAGE LIMIT
      const colours = coloursIn(Object.values(ring).join(" "));
      if (selfContrasting(colours)) { judged++; continue; }      // dark beside light reads on any surface
      for (const c of colours) {
        const cr = worst(c, deref(surf));
        if (cr == null) continue;                               // translucent — composites
        judged++;
        if (cr < 3) faint.push(`${r.sel} — ${c} on ${surf} is ${cr.toFixed(2)}:1 [${r.file}]`);
      }
    }
  }
  assert.ok(judged >= 5, `the ring scan must resolve surfaces to judge (judged ${judged})`);
  assert.deepEqual(faint, [], "a state ring the player cannot see:\n" + faint.join("\n"));
});

test("guardrail: no CSS declaration is WHOLLY DEAD — one selector, one owner", () => {
  // A declaration is WHOLLY DEAD when every selector in its rule is declared
  // again, for the same property, by a LATER rule in the same cascade context:
  // the same selector text is the same specificity, so the later one wins on
  // source order every time and the earlier can never paint. That is not
  // tidiness. It is how `.pattern__cell` came to be two games' cell at once —
  // What Comes Next's copy was dead for its whole life, and it took the ❓
  // slot's highlight down with it — and how `.coin` drew Piggy Bank's buttons
  // as Coin Mix-Up's 76px circles while Piggy Bank's `min-width` leaked the
  // other way and drew a penny and a nickel the same size. Whoever edits the
  // dead copy sees nothing change, which is the recorded ".td-abil at 52 vs
  // 60" defect: a size declared twice has no owner.
  //
  // What this deliberately does NOT flag, because it is the ordinary cascade:
  //  - a comma-LIST reset overridden for ONE member (`.tap, .choice { border:
  //    none }` then `.choice { border: 2px … }`): the reset still paints the
  //    other members, so it is alive;
  //  - an override inside an at-rule: it is conditional, so the base still
  //    paints whenever the condition fails. Each condition is its OWN context,
  //    and the same condition written twice is ONE context;
  //  - an earlier `!important` beaten only by a later plain declaration.
  //
  // The document is the PAGE in cascade order — main.css and td.css are one
  // document, wordcards.html's inline block is another — so a duplicate that
  // straddles two files is still caught.
  const blank = (x) => x.replace(/[^\n]/g, " ");
  const rulesOf = (chunk) => {
    // Comments and string contents are blanked to spaces (newlines kept, so
    // every offset — and so every line number — stays true): a brace inside
    // `content: "}"` would otherwise desync the walk and fail OPEN.
    const text = chunk.css.replace(/\/\*[\s\S]*?\*\//g, blank);
    const css = text.replace(/"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'/g, (m) => m[0] + blank(m.slice(1, -1)) + m[0]);
    const out = [];
    (function walk(lo, hi, ctx) {
      let i = lo, start = lo;
      while (i < hi) {
        if (css[i] === "{") {
          const raw = css.slice(start, i), pre = raw.trim();
          let j = i + 1, d = 1;
          while (j < hi && d > 0) { if (css[j] === "{") d++; else if (css[j] === "}") d--; j++; }
          if (pre.startsWith("@")) {
            // @media/@supports hold RULES; @keyframes/@font-face do not.
            if (/^@(media|supports|layer|container)\b/.test(pre)) walk(i + 1, j - 1, ctx + " " + pre.replace(/\s+/g, " "));
          } else {
            const lead = start + (raw.length - raw.trimStart().length);
            out.push({
              ctx: ctx.trim() || "(top level)", file: chunk.file,
              line: chunk.line0 + css.slice(0, lead).split("\n").length,
              sel: text.slice(start, i).trim().replace(/\s+/g, " "), body: text.slice(i + 1, j - 1),
            });
          }
          i = j; start = j; continue;
        }
        if (css[i] === ";" || css[i] === "}") start = i + 1;
        i++;
      }
    })(0, css.length, "");
    return out;
  };
  // Split on commas and semicolons only at depth 0 and outside quotes, so
  // `:is(.a, .b)`, `[data-x="a,b"]` and `url(x;y)` stay whole.
  const splitTop = (x, sep) => {
    const parts = []; let d = 0, q = "", cur = "";
    for (const ch of x) {
      if (q) { if (ch === q) q = ""; cur += ch; continue; }
      if (ch === '"' || ch === "'") { q = ch; cur += ch; continue; }
      if (ch === "(" || ch === "[") d++; else if (ch === ")" || ch === "]") d--;
      if (ch === sep && d === 0) { parts.push(cur); cur = ""; } else cur += ch;
    }
    parts.push(cur);
    return parts;
  };
  const declsOf = (body) => {
    const m = new Map();
    for (const d of splitTop(body, ";")) {
      const k = d.indexOf(":");
      if (k < 1) continue;
      const prop = d.slice(0, k).trim().toLowerCase(), v = d.slice(k + 1).replace(/\s+/g, " ").trim();
      if (prop && v) m.set(prop, { v, imp: /!\s*important$/i.test(v) });
    }
    return m;
  };

  const dead = [];
  let idiom = 0, rules = 0, contexts = 0;
  for (const page of PAGES) {
    const chunks = pageSheets(page);
    const all = chunks.flatMap(rulesOf).map((r) => ({
      ...r, mem: splitTop(r.sel, ",").map((x) => x.trim()).filter(Boolean), d: declsOf(r.body),
    }));
    // A page that loads CSS must yield rules, or a broken walk passes on nothing.
    if (chunks.some((c) => c.css.trim())) assert.ok(all.length > 0, `${page} loads CSS but the walk found no rules in it`);
    rules += all.length;
    const byCtx = new Map();
    for (const r of all) { if (!byCtx.has(r.ctx)) byCtx.set(r.ctx, []); byCtx.get(r.ctx).push(r); }
    contexts += byCtx.size;
    for (const list of byCtx.values()) {
      list.forEach((r, i) => {
        for (const [prop, dv] of r.d) {
          const killers = r.mem.map((sel) => list.slice(i + 1).find((q) =>
            q.mem.includes(sel) && q.d.has(prop) && !(dv.imp && !q.d.get(prop).imp)));
          const n = killers.filter(Boolean).length;
          if (n === r.mem.length) {
            dead.push(`${r.file}:${r.line} ${r.sel} { ${prop}: ${dv.v} } — declared again at ` +
              [...new Set(killers.filter(Boolean).map((k) => `${k.file}:${k.line}`))].join(", "));
          } else if (n) idiom++;
        }
      });
    }
  }
  // Floors, each for a different way this can pass while seeing nothing: the
  // walk finding no rules; never entering an at-rule (every media override
  // would then be invisible, rather than correctly ignored); and never meeting
  // the list-reset idiom at all, which would mean it never compared two rules.
  assert.ok(rules >= 1000, `the rule walk must find the app's rules (saw ${rules})`);
  assert.ok(contexts >= 8, `the walk must enter at-rule blocks as their own contexts (saw ${contexts})`);
  assert.ok(idiom >= 5, `the scan must meet the ordinary list-reset override (saw ${idiom})`);
  const brief = dead.length <= 12 ? dead : [...dead.slice(0, 12), `… and ${dead.length - 12} more`];
  assert.deepEqual(dead, [], `CSS that can never paint (${dead.length}) — delete it, or merge it into ` +
    `the rule that wins:\n  ${brief.join("\n  ")}`);
});

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
  // the PROPERTY, not the line: __onHide also pauses a round's end now (see
  // "THE ANSWERED ROUND IS OVER"), and a literal pin of its old one-call body
  // turned a law about timers into a law about spelling
  assert.match(fw, /screen\.__onHide = \(\) => \{[^}]*\bclearTimers\(\);[^}]*\}/, "screens clear their timers on hide");
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
    // commit.gpgsign is TRUE in this sandbox, globally, so a throwaway clone
    // inherits it and every commit below calls out to a code-signing service.
    // A 503 there once turned this test — whose subject is a shell script's
    // branch logic — red, and cost a full gate. Nothing here asserts anything
    // about a signature, so the dependency is simply removed: same class as the
    // verify-live transport retry, where an external service on the critical
    // path makes a transient indistinguishable from a real failure.
    sh("git config user.email t@t && git config user.name t && git config commit.gpgsign false && mkdir -p .claude", work);
    // Read back what git will ACTUALLY do, rather than trusting the line above:
    // if the setting is ever dropped, this clone silently inherits the global
    // `true` and every commit below goes back to needing the signing service.
    assert.equal(sh("git config --get commit.gpgsign", work).trim(), "false",
      "the throwaway clone must not sign its commits — a signing outage would then redden " +
      "this test, whose subject is a shell script and which asserts nothing about signatures");
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
  // is 623 cards of player copy in one inline block). tools/ and tests/ stay out
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
  //
  // The ban was MARKUP-ONLY, and that scope was a coincidence of where the
  // FIRST defect sat. Every count the page actually renders is built in the
  // SCRIPT — WORDS.length + " cards", HANZI.length + " cards", the per-deck
  // `count` — so the one region the ban covered is not the region its subject
  // lives in, and the three correct call sites prove that shape is live. A
  // fourth one typed rather than counted was invisible. Measured clean in both
  // halves today, so this is COVERAGE rather than a fix.
  //
  // Widening it NAIVELY is the false-positive machine this repo keeps refusing:
  // measured, /\d+\s*cards/ over the whole script has exactly ONE hit and it is
  // a COMMENT illustrating the aria-label format. So each half is comment-immune
  // by the means its own syntax gives — HTML comments stripped from the markup
  // (which carries four, so the same trap was latent on that side too), and the
  // script read as STRING LITERALS, where a comment can never appear at all.
  const src = read("wordcards.html");
  const cut = src.indexOf("<script>");
  const markup = src.slice(0, cut).replace(/<!--[\s\S]*?-->/g, "");
  assert.doesNotMatch(markup, /\d+\s*(cards|rounds|words)/,
    "a literal card, round or word count is a claim that goes stale");
  // NO floor on this half, deliberately, and the asymmetry with the script half
  // below is measured rather than assumed. All four HTML comments sit in the
  // last 8% of the markup, so the realistic regex bug — a GREEDY `<!--[\s\S]*-->`
  // — costs 1272 bytes of 22946 and leaves the ban working on everything before
  // them (proven: the planted-count mutation is still caught under it). A floor
  // that could separate 21170 from 22125 would sit 125 bytes from the shipped
  // value and go red the day anyone writes a comment, which is a coin flip, not
  // a bound. The strip's OTHER failure — no longer matching — is self-announcing
  // rather than silent, because it puts the comments back in scope and fires the
  // ban. The script half genuinely needs its floor: its extractor CAN return
  // nothing, which bans nothing and stays green.

  const lits = stringLiterals(src.slice(cut));
  const typed = lits.filter((l) => /\d+\s*(cards?|rounds?|words?)\b/.test(l.text))
    .map((l) => `line ${l.line}: ${JSON.stringify(l.text.slice(0, 60))}`);
  assert.deepEqual(typed, [],
    "a card count that reaches the screen must be COUNTED, never typed:\n  " + typed.join("\n  "));
  // The extractor IS this half of the scan, so it needs its own floor: a broken
  // walk bans nothing and stays green. 3090 literals today. The " cards" anchor
  // is the self-verifying half — it is the suffix the three derived counts below
  // are built from, so finding it proves the walk reached the real strings
  // rather than merely returning a plausible number.
  assert.ok(lits.length > 1500, `only ${lits.length} string literals extracted — the scan failed OPEN`);
  assert.ok(lits.some((l) => l.text === " cards"),
    "the literal scan never reached the derived counts' own suffix");
  assert.doesNotMatch(src, /"n":\s*\d+/, "the per-category counts must not be stored, they must be counted");
  assert.match(src, /WORDS\.length \+ " cards"/, "the total must be read off WORDS");
  assert.match(src, /HANZI\.length \+ " cards"/, "the Chinese count must be read off HANZI too");
  assert.match(src, /hDeckOnce\(\)\.length \+ " words"/,
    "the listening game's word count must be read off the ladder it will deal");
  assert.match(src, /mDeck\(\)\.length \+ " rounds"/,
    "the matching button's round count must be read off the rounds it will deal");
  assert.match(src, /'<\/span><span class="ct">'\+count\+' cards/,
    "every deck count must come from the list that deck actually holds");
});

test("Word Cards: the repo tree's headline card count is the deck's real size", () => {
  // The sibling law above stops the PAGE stating a count it has to keep up to
  // date; nothing stopped its DOCUMENTATION doing exactly that, and it had.
  // CLAUDE.md introduced the file as "a 503-card flash-card deck" — written
  // before the Chinese deck landed, never moved when 中文 was appended to the
  // same entry — while its own mobile.test.js entry 88 lines below said "the
  // whole 623-card library". Two counts for one page, in one document,
  // disagreeing: this repo's most reliable tell, and its most repeated defect
  // class (a list that outlives its contents), inside the reference doc that
  // names that class ten times.
  //
  // Scoped to the HEADER LINE of the wordcards entry on purpose. That line
  // introduces the file, so its count is the file's size — which is a PROPERTY,
  // not a value, so it is not a fence around one number. A count elsewhere in
  // the prose may legitimately describe one deck (503 English, 120 Chinese),
  // and a law banning those would fire on correct writing.
  const doc = read("CLAUDE.md");
  const line = doc.split("\n").find((l) => l.startsWith("├── wordcards.html"));
  assert.ok(line, "CLAUDE.md must still name wordcards.html in the repo tree");
  const m = line.match(/(\d+)-card/);
  assert.ok(m, `the wordcards tree entry must state its size — saw ${line.trim()}`);
  const total = wcWords().length + wcHanzi().length;
  assert.equal(Number(m[1]), total,
    `CLAUDE.md introduces Word Cards as a ${m[1]}-card deck; the page holds ${total}`);
  // Non-vacuous: the derivation must have actually read both decks, or a broken
  // extractor would make this pass on an empty page.
  assert.ok(total > 400, `the deck extraction found only ${total} cards`);
});

test("the repo tree's counts are the data's counts, derived with no pairing list", () => {
  // The sibling above pins ONE count on ONE line, because wordcards.html is a
  // page rather than a module and there is nothing to derive against. For a
  // dual-export DATA module there is: a count in that file's own tree entry
  // whose NOUN uppercases to one of that file's own exports must equal that
  // export's size. No map from prose to field is written down, so a future
  // export inherits the law the day the tree entry mentions it.
  //
  // It found a second instance of the stale-count class immediately: the
  // td-data entry said "18 achievements" — 9 bosses + 9 cross-cutting, true
  // until World 10's boss badge made it 19 — in an entry that HAD been updated
  // for that world in every other respect ("10 bosses/40 levels (10 worlds")).
  //
  // Scoped to scripts/ deliberately: requiring a tools/ file RUNS a sim and
  // requiring a tests/ file RUNS the suite (both hung a probe that tried).
  const doc = read("CLAUDE.md");
  const tree = doc.slice(doc.indexOf("## Repository Structure"), doc.indexOf("## Conventions"));

  // A logical entry is the line naming a file plus its continuation comments.
  const entries = [];
  let cur = null;
  for (const l of tree.split("\n")) {
    const m = l.match(/[├└]── ([\w.\-]+)/);
    if (m) { cur = { file: m[1], text: l }; entries.push(cur); }
    else if (cur && /^\s*│?\s*│?\s*#/.test(l)) cur.text += "\n" + l;
  }
  assert.ok(entries.length > 20, `the tree walk found only ${entries.length} entries`);

  let checked = 0;
  const drift = [];
  for (const e of entries) {
    if (!/\.js$/.test(e.file)) continue;
    const p = path.join(root, "scripts", e.file);
    if (!fs.existsSync(p)) continue;
    let mod;
    try { mod = require(p); } catch (err) { continue; }
    if (!mod || typeof mod !== "object") continue;
    for (const m of e.text.matchAll(/(\d+)[\s-]([a-z]+)/g)) {
      const key = Object.keys(mod).find((k) => k === m[2].toUpperCase());
      if (!key) continue;
      const v = mod[key];
      const size = Array.isArray(v) ? v.length
        : (v && typeof v === "object" ? Object.keys(v).length : null);
      if (size === null) continue;
      checked += 1;
      if (Number(m[1]) !== size) {
        drift.push(`${e.file}: the tree says "${m[1]} ${m[2]}" but ${key} holds ${size}`);
      }
    }
  }
  // A derivation fails OPEN, so the floor is what stops a broken walk or a
  // renamed export making this pass by checking nothing.
  assert.ok(checked >= 3, `only ${checked} tree count(s) were derivable — the law is guarding nothing`);
  assert.deepEqual(drift, [], "a count in the tree entry disagrees with the data it describes");
});

// ---------------------------------------------------------------------------
// Word Cards is a READING tool, so the back of a card is the ANSWER. These are
// content-truth tests in the sense content.test.js means it: they restate what
// is true so an answer cannot silently go wrong.
// ---------------------------------------------------------------------------
const wcWords = () => JSON.parse(read("wordcards.html").match(/const WORDS = (\[.*?\]);/s)[1]);
const wcHanzi = () => JSON.parse(
  read("wordcards.html").match(/const HANZI = (\[[\s\S]*?\n\]);/)[1].replace(/,(\s*\])$/, "$1"));

// The SKELETON is this page's ONE definition of "these two pictures are the
// same thing": strip the presentation selector, skin tone, ZWJ and the
// interchangeable person bases. It is shared rather than copied because two
// definitions of one truth that must agree is the shape that has already
// produced a real disagreement here (the ch rule against NOT_A_TEAM).
const wcSkel = (pic) => [...pic].filter((ch) => {
  const cp = ch.codePointAt(0);
  return cp !== 0xfe0f && cp !== 0x200d && !(cp >= 0x1f3fb && cp <= 0x1f3ff) &&
         ch !== "\u2640" && ch !== "\u2642";
}).map((ch) => (/[\u{1F468}\u{1F469}\u{1F9D1}]/u.test(ch) ? "P"
             : /[\u{1F466}\u{1F467}\u{1F9D2}]/u.test(ch) ? "C" : ch)).join("");

test("Word Cards: no two cards share a picture — the back IS the answer", () => {
  // Measured on the deck as supplied: 188 of 493 cards shared a picture with
  // another card. 🍽️ meant eat, full, hungry, dish AND plate — so it named
  // none of them, and full/hungry are near-opposites wearing one picture.
  // A shared picture cannot confirm a word, which is the card's whole job.
  const by = new Map();
  for (const [w, pic, cat] of wcWords()) {
    if (cat === "sight") continue;              // the back is a sentence, not a picture
    if (!by.has(pic)) by.set(pic, []);
    by.get(pic).push(w);
  }
  const shared = [...by.entries()].filter(([, l]) => l.length > 1);
  assert.deepEqual(shared.map(([p, l]) => p + " = " + l.join("/")), [],
    "these cards cannot tell you which word you turned over");
  assert.ok(by.size > 300, `only ${by.size} pictures scanned — the parse failed open`);
});

// The picture law, DERIVED over every deck. The English half is the original:
// `baker` shipped as 👨‍🍳 and `cook` as 👩‍🍳 — the same chef in the same white
// hat — and a four-year-old does not read gender as the difference between a
// cook and a baker, so the card confirmed the WRONG word. The exact sibling
// laws compare CODEPOINTS and cannot see a near-twin at all.
//
// It is derived because 中文 arrived as a SECOND deck and inherited none of it:
// measured, nothing checked the 120 for a near-twin, so a 👨‍🍳/👩‍🍳 pair would
// have shipped there with the suite green. That is this repo's most-repeated
// defect class — when a feature grows a second container, every check scoped to
// the first one has quietly narrowed its claim — applied BEFORE the third deck
// rather than after it.
const WC_DECKS = [
  {
    name: "English", array: "WORDS", floor: 400,
    // A sight card's second field is a SENTENCE, not a picture: that deck
    // teaches the words you cannot sound out, so there is nothing to collide.
    cards: () => wcWords().filter((c) => c[2] !== "sight"),
    // The one case where the gender IS the answer, so each card still confirms
    // its own word. Both groups are gender words themselves, which is what
    // makes the carve-out principled rather than a list of whatever failed.
    exempt: [["mom", "dad"], ["boy", "girl", "kid"]],
  },
  {
    name: "Chinese", array: "HANZI", floor: 110,
    cards: () => wcHanzi(),
    // 爸 and 妈 ARE dad and mom, wearing those same two pictures — the English
    // exemption in a second writing system, measured rather than assumed. 蝴
    // and 蝶 mean butterfly only together, so one picture is the truth for
    // both. Both pairs are held to the TIGHTER exact law next door as well,
    // and the two clauses say different things: may not be the SAME picture,
    // versus may not differ only by gender.
    exempt: [["爸", "妈"], ["蝴", "蝶"]],
  },
];

test("Word Cards: no card wears another card's picture with the gender swapped", () => {
  const src = read("wordcards.html");
  // The deck table is DERIVED against the page rather than trusted: every
  // top-level ALL-CAPS array is either a walked DECK or a consciously named
  // non-deck, so a third deck is red until somebody says which it is. A
  // count-based floor would tolerate the first step of exactly the drift this
  // guards — a deck arriving while another is renamed away.
  const NOT_A_DECK = {
    FAMILIES: "rimes, not cards",
    PAIRS: "which two cards may not be dealt together",
    COLORS: "the card palette",
    SOUND_RULES: "how a word splits into sounds",
    READING: "the derived decks' own definitions",
    HEAR_SKIP: "words the listening game never SAYS (read aloud as letters)",
    HOMOPHONES: "words that may not share a listening board (they sound the same)",
  };
  const declared = [...src.matchAll(/^\s*const ([A-Z][A-Z_0-9]*) = \[/gm)].map((m) => m[1]);
  assert.ok(declared.length >= 5, `only ${declared.length} arrays found — the scan failed open`);
  assert.deepEqual(
    declared.filter((n) => !(n in NOT_A_DECK)).sort(), WC_DECKS.map((d) => d.array).sort(),
    "a card array on the page is not walked by the picture law (or a walked deck is gone)");

  assert.ok(WC_DECKS.length >= 2,
    `only ${WC_DECKS.length} deck(s) walked — a narrowed walk checks nothing`);

  for (const deck of WC_DECKS) {
    const by = new Map();
    for (const [word, pic] of deck.cards()) {
      const k = wcSkel(pic);
      if (!by.has(k)) by.set(k, []);
      by.get(k).push(word);
    }
    const legal = (l) => deck.exempt.some((g) => l.every((w) => g.includes(w)));
    const bad = [...by.values()].filter((l) => l.length > 1 && !legal(l));
    assert.deepEqual(bad.map((l) => l.join("/")), [],
      `${deck.name}: one picture, two cards — the gender is not what tells these apart`);
    assert.ok(by.size >= deck.floor,
      `${deck.name}: only ${by.size} skeletons scanned — the parse failed open`);
    // …and every exemption stays load-bearing rather than decorative: if a
    // group ever stops colliding, the carve-out is protecting nothing and
    // should go, so a future pair cannot slip in under a dead clause.
    //
    // Both clauses read the same skeleton, so ANY change to it also stops
    // mom/dad colliding and fires THIS clause rather than the one above —
    // measured, not assumed. Only restoring a real gendered twin isolates the
    // collision clause (baker 👨‍🍳 beside cook 👩‍🍳 reports "cook/baker"); a
    // third exempt group that never collides is what isolates this one.
    const collides = deck.exempt.filter((g) =>
      [...by.values()].some((l) => l.length > 1 && l.every((w) => g.includes(w))));
    assert.equal(collides.length, deck.exempt.length,
      `${deck.name}: an exempted group no longer collides — delete the exemption ` +
      "instead of keeping a dead one");
  }
});

test("Word Cards: every word appears exactly once", () => {
  const seen = new Set(), dup = [];
  for (const [w] of wcWords()) { if (seen.has(w)) dup.push(w); seen.add(w); }
  assert.deepEqual(dup, [], "a word on two cards teaches two answers");
  assert.ok(seen.size > 400, `only ${seen.size} words — the parse failed open`);

  // …and every card is the shape the page reads. Found while mutation-testing:
  // a card that had lost a field parsed as ["\u{1F427}", "animals"] and sailed
  // through every other check, because a malformed row still has a unique
  // "picture". A card one field short renders a category name as its answer.
  const cats = new Set(JSON.parse(read("wordcards.html").match(/const CATS  = (\[.*?\]);/s)[1]).map((c) => c.key));
  cats.add("sight");
  const malformed = wcWords().filter(
    (c) => !Array.isArray(c) || c.length !== 3 || !c.every((x) => typeof x === "string" && x) || !cats.has(c[2]));
  assert.deepEqual(malformed, [], "a card is not [word, picture, category]");
});

test("Word Cards: the pictures that showed the WRONG thing are gone", () => {
  // Every pair below shipped, and every one of them teaches something false.
  // The rule is not "find a closer picture" — it is that a word with no true
  // picture at Emoji <= 13.0 is dropped rather than approximated.
  const WRONG = [
    ["plum", "\u{1F347}"],   // grapes
    ["table", "\u{1FA91}"],  // a chair
    ["neck", "\u{1F9E3}"],   // a scarf
    ["pond", "\u{1F986}"],   // a duck
    ["garage", "\u{1F697}"], // a car
    ["dentist", "\u{1F9B7}"],// a tooth
    ["jam", "\u{1F36F}"],    // a honey pot
    ["sugar", "\u{1F35A}"],  // a bowl of rice
    ["wagon", "\u{1F6FB}"],  // a pickup truck
    ["belt", "\u{1F397}\u{FE0F}"], // a reminder ribbon
    ["rug", "\u{1F9F6}"],    // a ball of yarn
    ["towel", "\u{1F9FB}"],  // a toilet roll
    ["root", "\u{1F331}"],   // a seedling
    ["gray", "\u{1F418}"],   // an elephant
    ["thumb", "\u{1F44D}"],  // JOSH_PROFILE names this one by name
    ["zipper", "\u{1F910}"], // a zipper-MOUTH face
    ["hair", "\u{1F487}"],   // a person getting a HAIRCUT
    ["button", "\u{1F518}"], // a RADIO button — a grey circle
    ["cave", "\u{1F573}\u{FE0F}"], // literally "hole" on every platform
  ];
  const deck = wcWords();
  const bad = WRONG.filter(([w, pic]) => deck.some(([dw, dp]) => dw === w && dp === pic));
  assert.deepEqual(bad.map(([w, p]) => w + " = " + p), [], "a card is teaching the wrong picture");
});

test("Word Cards: every word family really rhymes", () => {
  // A family derived from SPELLING can be wrong, and this is a reading tool:
  // dove/glove rhyme and STOVE does not; boot/hoot rhyme and FOOT does not;
  // crow/snow rhyme and COW does not; food/mood rhyme and GOOD does not;
  // bear/pear rhyme and EAR does not. So the families are hand-verified data,
  // and the traps are named here so a future edit cannot quietly re-add one.
  const src = read("wordcards.html");
  const fams = JSON.parse(src.match(/const FAMILIES = (\[.*?\]);/s)[1]);
  const have = new Set(wcWords().map((w) => w[0]));
  const TRAPS = { ove: ["stove"], oot: ["foot"], ow: ["cow"], ood: ["good"], ear: ["ear"] };
  assert.ok(fams.length >= 20, `only ${fams.length} families — the parse failed open`);
  let members = 0;
  for (const [rime, list] of fams) {
    assert.ok(list.length >= 2, `-${rime} has only ${list.length} member(s); a family of one teaches no pattern`);
    for (const w of list) {
      members += 1;
      assert.ok(have.has(w), `-${rime} lists "${w}", which is not a card in the deck`);
      assert.ok(w.endsWith(rime), `"${w}" does not even end in -${rime}`);
      assert.ok(!(TRAPS[rime] || []).includes(w),
        `"${w}" is in -${rime} but does NOT rhyme with the rest of it`);
    }
  }
  assert.ok(members >= 50, `only ${members} family words — the walk failed open`);
  // And exactly ONE home each: rimeOf() returns the FIRST family that lists the
  // word, so a word in two families would have the card underline whichever was
  // typed first — goat taught as rhyming with cat. Measured clean today; the
  // mechanism is what makes it worth pinning.
  const homes = {};
  for (const [rime, list] of fams) for (const w of list) (homes[w] = homes[w] || []).push(rime);
  const twice = Object.entries(homes).filter(([, rs]) => rs.length > 1);
  assert.deepEqual(twice, [],
    `a word is taught in two families at once: ${twice.map(([w, rs]) => `${w} -> -${rs.join(" / -")}`).join(", ")}`);
});

test("Word Cards: every sight card's sentence contains its own word", () => {
  // The back of a sight card is a SENTENCE, not a picture, so the sentence IS
  // the control of error — "the dog ran" is what tells him he read "the". A
  // sentence missing its own word confirms nothing, and one built from words
  // he cannot read is not a sentence he can check himself against.
  const cards = wcWords().filter((c) => c[2] === "sight");
  assert.ok(cards.length >= 40, `only ${cards.length} sight cards — the parse failed open`);
  for (const [w, sentence] of cards) {
    const parts = sentence.toLowerCase().split(/[^a-z']+/).filter(Boolean);
    assert.ok(parts.includes(w.toLowerCase()),
      `"${sentence}" does not contain the word "${w}" it is meant to show`);
    assert.ok(parts.length <= 5, `"${sentence}" is ${parts.length} words — too long to read at four`);
    const hard = parts.filter((t) => t.length > 6);
    assert.deepEqual(hard, [], `"${sentence}" leans on words he cannot decode: ${hard.join(", ")}`);
  }
});

test("Word Cards: the two teaching decks keep their promise", () => {
  // A deck's LABEL is a claim. "First Words" promises you can sound the word
  // out, so a final w, y or r disqualifies it — those mark a vowel team or an
  // r-controlled vowel, and cow, key, boy, saw and car are not blendable: a
  // child sounding out k-e-y gets nothing. And a deck teaching the ch SOUND
  // must not hand him anchor (/k/) or parachute (/sh/), which are exactly the
  // counter-examples to the rule it is for.
  const src = read("wordcards.html");
  const cvc = src.match(/const CVC = \/(\S+?)\/;/);
  assert.ok(cvc, "the First Words rule is gone");
  const tail = cvc[1].match(/\[aeiou\]\[([a-z]+)\]\$$/);
  assert.ok(tail, `the First Words rule no longer ends in a consonant class: ${cvc[1]}`);
  for (const bad of ["w", "y", "r"])
    assert.ok(!tail[1].includes(bad),
      `"${bad}" is allowed to end a First Word, so the deck holds words he cannot blend`);
  // That exclusion USED to live in its own list, NOT_A_TEAM, and the two halves
  // of one truth disagreed: the deck dropped anchor and parachute while the
  // card's own sound strip still showed both of them an a-n-CH-o-r tile — the
  // very counter-example the deck is careful about, delivered by the other half
  // of the same feature. It is a SOUND_RULES exception now, which is the ONE
  // owner both the strip and every team deck read, so a second list may not
  // come back to disagree with it again.
  const ch = src.match(/\["ch", (\[[^\]]*\])\]/);
  assert.ok(ch, "the ch rule is gone from SOUND_RULES");
  for (const w of ["anchor", "parachute"])
    assert.ok(ch[1].includes('"' + w + '"'),
      `"${w}" must be excepted from the ch rule — its ch is not the sound that team makes`);
  assert.ok(!src.includes("NOT_A_TEAM"),
    "a second list of team exclusions is back beside SOUND_RULES; there may be only one");
});

test("Word Cards: the sound split keeps its verified exceptions", () => {
  // "ship" is three sounds, not four, and the strip used to show four on 67
  // words — on exactly the digraph skill Josh's report lists as his working
  // edge. An algorithm alone is NOT safe: "ng" is one sound in sing and ring
  // and is plain n+g in these seven, which is why they are named in the data.
  const src = read("wordcards.html");
  const rules = src.match(/const SOUND_RULES = \[([\s\S]*?)\n\];/);
  assert.ok(rules, "the sound rules are gone — the strip is back to one tile per letter");
  for (const w of ["penguin", "kangaroo", "mango", "orange", "finger", "sponge", "flamingo"])
    assert.ok(rules[1].includes('"' + w + '"'),
      `"${w}" must be excepted from the ng rule — its n and g are separate sounds`);
  assert.ok(rules[1].includes('"koala"'), "koala must be excepted from the oa rule");
  assert.ok(rules[1].includes('"eight"'), "eight must be excepted from the igh rule (it is ei-gh)");
  // Same discipline for the teams that arrived with the Letter teams section.
  // Each of these is a word where the letters are NOT that team, and each was
  // splitting WRONG before it was named: door showed d-OO-r for a word that
  // says "dor", and tongue showed t-o-NG-u-e.
  //
  // Read PER RULE rather than anywhere in the table. The looser form is a false
  // pass waiting to happen and one of the entries below proves it: "four" is
  // excepted from BOTH ou and ur, and a whole-table `includes` is satisfied by
  // either, so it would report the ur exception present while it was missing.
  const ruleList = (pat) => {
    const m = rules[1].match(new RegExp('\\["' + pat + '", (\\[[\\s\\S]*?\\])\\]'));
    return m ? m[1] : null;
  };
  for (const [w, rule] of [["door", "oo"], ["tongue", "ng"], ["mountain", "ai"],
                           ["soup", "ou"], ["four", "ou"], ["yoyo", "oy"],
                           // BOSSY R could not be a substring match, and these
                           // are the words that prove it: bear/pear/hare say
                           // /air/, earth says /er/, heart says /ar/ but is
                           // SPELLED ear, parrot is a short a, lizard ends in
                           // /erd/, worm says "werm", and four/dinosaur are
                           // ou/au that happen to be followed by an r.
                           ["bear", "ar"], ["pear", "ar"], ["hare", "ar"],
                           ["heart", "ar"], ["earth", "ar"], ["parrot", "ar"],
                           ["lizard", "ar"], ["kangaroo", "ar"],
                           ["berry", "er"], ["cherry", "er"], ["zero", "er"],
                           ["fire", "ir"], ["giraffe", "ir"], ["siren", "ir"],
                           ["worm", "or"], ["doctor", "or"], ["anchor", "or"],
                           ["four", "ur"], ["dinosaur", "ur"]]) {
    const list = ruleList(rule);
    assert.ok(list, `the ${rule} rule is gone from SOUND_RULES`);
    assert.ok(list.includes('"' + w + '"'),
      `"${w}" must be excepted from the ${rule} rule — those letters do not say that team in it`);
  }
  // chair and fairy USED to be ai exceptions and are deliberately not any more.
  // `air` out-ranks `ai` now, so it takes those letters first and the two
  // entries were provably dead — measured, dropping both moves ZERO of the 503
  // strips. Two mechanisms for one truth is exactly how the ch rule and
  // NOT_A_TEAM came to disagree, so the guarantee is the ORDER, pinned below.
  for (const w of ["chair", "fairy"])
    assert.ok(!ruleList("ai").includes('"' + w + '"'),
      `"${w}" is back in the ai exceptions — air out-ranks ai, so that entry is dead weight`);
  for (const pat of ["tch", "sh", "ch", "th", "ck", "qu", "ph", "wh", "ee", "oo", "oa", "ai",
                     "ow", "ou", "ng", "air", "oar", "ar", "er", "ir", "or", "ur"])
    assert.ok(new RegExp('\\["' + pat + '"').test(rules[1]), `the ${pat} rule is missing`);
  // Exactly TWO rules have to out-rank another, and they are the only pairs in
  // the table that can match at the SAME letter. Everything else is teaching
  // order: measured, moving er or ur to the front changes none of the 503 strips.
  //
  // "tch before ch" was pinned here too, and is REMOVED, because that clause
  // could never fail — ch cannot match a string starting "tch", so no ordering
  // of the two changes anything, and demoting tch below ch moves zero strips.
  // What watch actually needs is for tch to EXIST, which the presence loop
  // above now covers and nothing did before: the order was guarded by an
  // unfalsifiable clause while the thing that mattered was guarded by nothing.
  for (const [first, second, breaks] of [["air", "ai", "chair splits as ch-ai-r"],
                                         ["oar", "oa", "skateboard splits as b-oa-r-d"]])
    assert.ok(rules[1].indexOf('["' + first + '"') < rules[1].indexOf('["' + second + '"'),
      `${first} must come before ${second} in SOUND_RULES, or ${breaks}`);
  // The Bossy R section's membership is DERIVED — a single vowel then r IS the
  // phonics definition — so a hand-written list of the five cannot come back
  // and drift from the table. It deliberately does not claim air/oar/ear, which
  // are vowel TEAMS with an r and are a different lesson.
  assert.ok(/const BOSSY = \/[^/]+\/;/.test(src),
    "the Bossy R partition is gone, or is no longer a pattern");
  assert.ok(!/\[\s*"ar"\s*,\s*"er"\s*,\s*"ir"\s*,\s*"or"\s*,\s*"ur"\s*\]/.test(src),
    "the Bossy R teams are back as a hand-written list; the partition must derive from the pattern");
});

// ---------------------------------------------------------------------------
// 中文 — the 120 characters of the 第2级总字表 the owner supplied as a photo of
// the printed table. Same content-truth discipline as the English half: the
// back of the card is the ANSWER, so what it claims is restated here, where it
// can go red. The deck is a second WRITING SYSTEM rather than a fifteenth
// category, which is why it lives in its own array — see the guardrail below
// that keeps it out of every English derivation.
// ---------------------------------------------------------------------------
test("Word Cards: the Chinese deck IS the printed 第2级 table, all 120 in order", () => {
  // Transcribed from the photo, ten rows of twelve — and transcribed rather
  // than derived from the deck, which is the whole point of a truth test: a
  // character that drifts out of the data has something to disagree with.
  const TABLE = [
    "一二三四五六七八九十两只",
    "头又了不大小上下多少白天",
    "云山太阳月亮星马牛羊兔虫",
    "鸟花草树地吃看走笑来飞爱",
    "是跑跳高兴快乐好的爸妈我",
    "人儿子口几个中牙门手心什",
    "么开可回出去里床车家爷奶",
    "你水饭有找坐听玩哭起喝到",
    "河海风雨雪春夏秋冬鱼狼猫",
    "狗蝴蝶蜜蜂谢睡红蓝绿美丽",
  ];
  const want = TABLE.join("");
  // The transcription's own arithmetic, or a dropped character would quietly
  // move the bar it is being compared against.
  assert.equal(TABLE.length, 10, `the printed table is ten rows, not ${TABLE.length}`);
  for (const row of TABLE) assert.equal([...row].length, 12, `"${row}" is not twelve characters`);
  assert.equal([...want].length, 120, "the transcription is not 120 characters");

  const deck = wcHanzi();
  assert.equal(deck.map((c) => c[0]).join(""), want,
    "the Chinese deck no longer matches the printed character table");
  assert.equal(new Set(deck.map((c) => c[0])).size, 120, "a character is on two cards");
  // The table's own order is kept in the DATA (it is the order they are taught
  // in, and it is how the next author checks it against the photo); the deck is
  // shuffled by teachingOrder at open time, exactly like a picture category.
  for (const c of deck)
    assert.ok(/^[一-鿿]$/.test(c[0]), `"${c[0]}" is not a single han character`);
});

test("Word Cards: every Chinese card carries all six of its parts, in the right script", () => {
  const deck = wcHanzi();
  assert.equal(deck.length, 120, `only ${deck.length} cards — the parse failed open`);
  for (const c of deck) {
    assert.ok(Array.isArray(c) && c.length === 7 && c.every((x) => typeof x === "string" && x),
      `not [character, picture, "hanzi", pinyin, meaning, sentence, translation]: ${JSON.stringify(c)}`);
    assert.equal(c[2], "hanzi", `${c[0]} is not filed under hanzi, so render() would treat it as English`);
    const [ch, , , py, gloss, sent, tr] = c;
    // Pinyin is a ROMANISATION: latin letters, tone marks and ü, nothing else.
    // A han character in this field means the reading was never written.
    assert.match(py, /^[a-züĀ-ǿà-ü]+$/i, `${ch}: "${py}" is not pinyin`);
    // The meaning and the translation are what a grown-up who reads no Chinese
    // uses, so each must actually contain English. (A meaning may name the
    // compound the character lives in — "sun (太阳)" — so han is allowed there
    // and banned in the translation, which is a whole English sentence.)
    assert.match(gloss, /[a-z]/i, `${ch}: the meaning "${gloss}" has no English in it`);
    assert.match(tr, /[a-z]/i, `${ch}: the translation "${tr}" has no English in it`);
    assert.doesNotMatch(tr, /[一-鿿]/, `${ch}: the translation "${tr}" still has Chinese in it`);
    // The sentence is Chinese and only Chinese — latin or a digit in it means a
    // placeholder survived.
    assert.doesNotMatch(sent, /[a-z0-9]/i, `${ch}: the sentence "${sent}" is not all Chinese`);
    // The sight deck's law, in the other language: the sentence IS the control
    // of error, so one that does not contain its own character confirms nothing.
    assert.ok(sent.indexOf(ch) >= 0, `${ch}: "${sent}" does not contain the character it is meant to show`);
    const n = [...sent].filter((x) => /[一-鿿]/.test(x)).length;
    assert.ok(n >= 2 && n <= 6, `${ch}: "${sent}" is ${n} characters — too long to read at four`);
  }
});

test("Word Cards: no two Chinese cards share a picture, except the one bound pair", () => {
  // The English law, with one difference stated rather than assumed: there the
  // picture IS the answer, here the answer is how you SAY the character and the
  // picture is a meaning cue. It still has to be distinct — a cue two cards
  // share tells you nothing about either — with ONE exemption, and it is
  // principled rather than a fence: 蝴 and 蝶 have no meaning apart, they mean
  // butterfly only together, so one picture is the truth for both.
  const BOUND = [["蝴", "蝶"]];
  const by = new Map();
  for (const c of wcHanzi()) {
    if (!by.has(c[1])) by.set(c[1], []);
    by.get(c[1]).push(c[0]);
  }
  const legal = (l) => BOUND.some((g) => l.every((ch) => g.includes(ch)));
  const bad = [...by.entries()].filter(([, l]) => l.length > 1 && !legal(l));
  assert.deepEqual(bad.map(([p, l]) => p + " = " + l.join("/")), [],
    "two Chinese cards wear the same picture");
  assert.ok(by.size >= 119, `only ${by.size} pictures — the parse failed open`);
  // …and the exemption stays load-bearing rather than decorative, so a future
  // pair cannot slip in under a dead clause.
  const collides = BOUND.filter((g) => [...by.values()].some((l) => l.length > 1 && l.every((ch) => g.includes(ch))));
  assert.equal(collides.length, BOUND.length,
    "an exempted pair no longer shares a picture — delete the exemption instead of keeping a dead one");
});

test("Word Cards: a Chinese measure word agrees with the one 华丽's world teaches", () => {
  // Measure words are the most error-prone thing in elementary Chinese — this
  // repo already shipped one defect over them (只 offered as a WRONG answer for
  // 鞋, when one shoe really is 一只鞋) — and the app now teaches them in TWO
  // places: 华丽's 量词搭配 quiz, where picking the wrong one is marked WRONG,
  // and these 120 cards, which use one 22 times with nothing checking any of
  // them. Two owners of one truth is this repo's most repeated defect shape, so
  // the SHARED nouns are READ from her file instead of re-declared here: a
  // contradiction between the two worlds cannot be written.
  //
  // The near-miss that motivated it is real. Choosing 牛's sentence, 一头牛 is
  // right and 一只牛 is wrong — and 牛 IS in her table, so that edit now goes
  // red instead of quietly contradicting grandma's quiz two screens away.
  const hl = read("scripts/hl-content.js");
  const her = {};
  for (const m of hl.matchAll(/\{ noun: "([^"]+)", emoji: "[^"]*", mw: "([^"]+)"(?:, alsoOk: \[([^\]]*)\])? \}/g))
    her[m[1]] = { mw: m[2], also: (m[3] || "").split(",").map((x) => x.replace(/["\s]/g, "")).filter(Boolean) };
  for (const m of hl.matchAll(/\{ emoji: "[^"]*", name: "([^"]+)", mw: "([^"]+)" \}/g))
    her[m[1]] = { mw: m[2], also: [] };
  assert.ok(Object.keys(her).length >= 10,
    `only ${Object.keys(her).length} nouns read from 华丽's tables — the scan failed open`);

  // The nouns the deck uses that her world does not teach. Declared, because
  // there is no other owner for them — the same truth-restatement the sentence
  // law next door uses.
  const DECK_ONLY = {
    人: "个", 手指: "个", 家: "个",
    猫: "只", 狗: "只", 羊: "只", 手: "只",
    兔子: "只", 蝴蝶: "只", 蜜蜂: "只", 虫: "只",
  };

  // A measure word only counts in MEASURE-WORD POSITION — directly after a
  // number or 这/那/几. Without that clause 头 in 我的头很大 reads as the measure
  // word for cattle instead of the noun "head", which is exactly what the first
  // cut of this scan reported. A modifier (小鸟, 白羊) may sit in between.
  const NUM = /[一二三四五六七八九十两几这那]/;
  const MOD = /[小大白红老好]/;
  const MWS = /[只个朵条头匹本把辆件双]/;
  const known = (n) => Object.prototype.hasOwnProperty.call(her, n) ||
                       Object.prototype.hasOwnProperty.call(DECK_ONLY, n);

  let uses = 0, shared = 0;
  for (const card of wcHanzi()) {
    const sent = card[5];
    for (let i = 1; i < sent.length; i++) {
      if (!MWS.test(sent[i]) || !NUM.test(sent[i - 1])) continue;
      let j = i + 1;
      while (j < sent.length && MOD.test(sent[j])) j++;
      // Prefer a KNOWN two-character noun (手指, 兔子, 金鱼); otherwise the
      // single character — never a blind two-char slice, which turned 这只狗很大
      // into the noun "狗很". KNOWN LIMIT, measured: a longer compound that
      // BEGINS with a known noun is scored on that prefix (八只猫头鹰 is read as
      // 猫), so the heuristic can name the wrong noun on a word neither table
      // lists. That is why the law's teeth are the SHARED half, which is exact:
      // it matches a noun 华丽's file actually declares.
      const two = sent.slice(j, j + 2);
      const noun = known(two) ? two : sent.slice(j, j + 1);
      uses += 1;
      const mine = her[noun];
      if (mine) {
        shared += 1;
        assert.ok(mine.mw === sent[i] || mine.also.indexOf(sent[i]) >= 0,
          `${card[0]}: "${sent}" counts ${noun} with ${sent[i]}, but 华丽's world ` +
          `teaches ${noun} → ${mine.mw} — the two worlds must not disagree`);
      } else {
        assert.ok(DECK_ONLY[noun],
          `${card[0]}: "${sent}" counts ${noun} with ${sent[i]}, and no table says ` +
          "which measure word that noun takes");
        assert.equal(DECK_ONLY[noun], sent[i],
          `${card[0]}: "${sent}" counts ${noun} with ${sent[i]}, not ${DECK_ONLY[noun]}`);
      }
    }
  }
  assert.ok(uses >= 15, `only ${uses} measure words found — the scan failed open`);
  assert.ok(shared >= 2,
    `only ${shared} of the deck's measure words touch a noun 华丽's world also ` +
    "teaches — the cross-world half of this law is guarding nothing");
});

test("Word Cards: a Chinese sentence's COUNT agrees with its English", () => {
  // The shipped clauses check that a translation HAS English and has no
  // Chinese. Neither can see it stating a different NUMBER — on a deck whose
  // first ten cards are 一..十, where being taught that six is seven is the
  // exact defect the thing exists to prevent. 20 of the 120 sentences state a
  // quantity, and nothing checked one of them.
  //
  // It is a live risk rather than a theoretical one: two of these sentences
  // were rewritten by hand the day before this law was written, and one of
  // them (口 -> 我喝一口水) carries a numeral.
  //
  // Which character is which number is read from 华丽's CN_NUM by INDEX, so the
  // two Chinese worlds cannot disagree about it and the expectation cannot be
  // derived from the thing under test.
  const hl = read("scripts/hl-content.js");
  const cn = JSON.parse(hl.match(/CN_NUM: (\[[^\]]*\])/)[1].replace(/'/g, '"'));
  assert.equal(cn.length, 10, `CN_NUM read as ${cn.length} entries — the scan failed open`);
  const DIGIT = {};
  cn.forEach((ch, i) => { DIGIT[ch] = i + 1; });
  // 两 is the form Chinese uses before a measure word (两只手, never 二只手).
  // Her file has no entry for it, so it is declared here with its reason — and
  // a floor below asserts the deck actually uses it, or this line guards
  // nothing.
  DIGIT["两"] = 2;

  const WORD = ["one", "two", "three", "four", "five", "six", "seven", "eight",
                "nine", "ten", "eleven", "twelve"];
  const MONTH = ["january", "february", "march", "april", "may", "june", "july",
                 "august", "september", "october", "november", "december"];
  const has = (tr, w) => new RegExp(`\\b${w}\\b`, "i").test(tr);

  // A maximal RUN, never a character at a time: 十二 is twelve, not ten then
  // two, and reading it per character would report two spurious failures. A
  // run this does not understand fails LOUDLY rather than being skipped.
  const valueOf = (run) => {
    const d = [...run].map((ch) => DIGIT[ch]);
    if (d.length === 1) return d[0];
    if (d.length === 2 && d[0] === 10) return 10 + d[1];
    if (d.length === 2 && d[1] === 10) return d[0] * 10;
    return null;
  };

  let counted = 0, article = 0, month = 0, liang = 0;
  const seen = new Set();
  for (const card of wcHanzi()) {
    const sent = card[5], tr = card[6];
    for (const m of sent.matchAll(/[一二三四五六七八九十两]+/g)) {
      const run = m[0], v = valueOf(run);
      assert.ok(v !== null,
        `${card[0]}: "${sent}" — this scan does not understand the numeral ${run}`);
      if (run.indexOf("两") >= 0) liang += 1;

      // A numeral before 月 is a MONTH NAME, not a count (二月 is February).
      // The same position rule the measure-word law next door needs — and it
      // is CHECKED rather than skipped, so the exception is falsifiable.
      if (sent[m.index + run.length] === "月") {
        month += 1;
        assert.ok(MONTH[v - 1] && has(tr, MONTH[v - 1]),
          `${card[0]}: "${sent}" is month ${v} (${MONTH[v - 1]}), but the ` +
          `translation "${tr}" does not name it`);
        continue;
      }

      counted += 1;
      seen.add(v);
      if (WORD[v - 1] && (has(tr, WORD[v - 1]) || has(tr, String(v)))) continue;
      // 一 + a measure word is normally "a"/"an" in English (一只猫 is "a cat",
      // not "one cat"), which is grammar rather than a loophole — but only
      // where the translation names no OTHER number, so it cannot swallow a
      // real disagreement.
      const other = WORD.some((w, i) => i + 1 !== v && has(tr, w));
      assert.ok(v === 1 && !other && has(tr, "an?"),
        `${card[0]}: "${sent}" counts ${v}, but the translation "${tr}" does ` +
        `not say ${WORD[v - 1] || v}`);
      article += 1;
    }
  }
  assert.ok(counted >= 15, `only ${counted} counted quantities — the scan failed open`);
  assert.ok(seen.size >= 8,
    `the quantities seen were only ${[...seen].sort((a, b) => a - b).join(",")} — ` +
    "a scan that only ever meets 一 proves almost nothing");
  assert.ok(article >= 1, "no sentence rendered 一 as a/an — that exception is dead code");
  assert.ok(month >= 1, "no month name was checked — that exception is dead code");
  assert.ok(liang >= 1, "the deck never uses 两, so declaring it here guards nothing");
});

test("Word Cards: every 多音字 carries the reading its own card teaches", () => {
  // The shipped clause checks a pinyin's SHAPE — "latin letters, tone marks and
  // ü, nothing else" — which cannot see a WRONG reading, on a card the app
  // SPEAKS. All 120 were audited by hand and are correct; these are the ones
  // where wrong is a live possibility, so they are restated where they can go
  // red.
  //
  // The list is scoped by a real property rather than by taste: a character
  // belongs here when its other reading is a DIFFERENT WORD. That deliberately
  // excludes 头 and 子, whose second form is a neutral-tone variant inside a
  // compound (木头, 儿子) rather than another word — the card gives the citation
  // reading, which is what a character card is for.
  const POLYPHONIC = [
    ["只", "zhī", "zhǐ", "the measure word (一只白羊), not 只 = only"],
    ["了", "le",  "liǎo", "the completion particle (我吃完了), not 了 = to finish"],
    ["少", "shǎo", "shào", "few (水很少), not 少 = young as in 少年"],
    ["地", "dì",  "de",   "ground (花在地上), not the adverbial particle"],
    ["的", "de",  "dì",   "the possessive (爸爸的车), not 的 as in 目的"],
    ["兴", "xìng", "xīng", "glad (高兴), not 兴 = to prosper"],
    ["乐", "lè",  "yuè",  "happy (快乐), not 乐 = music as in 音乐"],
    ["中", "zhōng", "zhòng", "middle (中国), not 中 = to hit as in 中奖"],
    ["什", "shén", "shí",  "what (什么), not 什 as in 什锦"],
    ["好", "hǎo", "hào",  "good (你好), not 好 = to be fond of"],
    ["几", "jǐ",  "jī",   "how many (你有几只猫), not 几 as in 几乎"],
    ["大", "dà",  "dài",  "big (这只狗很大), not 大 as in 大夫"],
  ];
  const deck = wcHanzi();
  assert.ok(POLYPHONIC.length >= 10,
    `only ${POLYPHONIC.length} readings pinned — the list is not worth having`);
  for (const [ch, want, other, why] of POLYPHONIC) {
    const card = deck.find((c) => c[0] === ch);
    assert.ok(card, `${ch} is no longer in the deck, so this pin guards nothing`);
    assert.equal(card[3], want,
      `${ch}: the card teaches ${why} — so it is read "${want}", not "${card[3]}"` +
      (card[3] === other ? ` (that is the OTHER word's reading)` : ""));
  }
});

test("Word Cards: a Chinese sentence must teach the sense its card GLOSSES", () => {
  // The back of a card is the ANSWER, and for 中文 the answer is the character's
  // meaning and its reading. A sentence that scans perfectly can still teach the
  // wrong word, which no scan can see — the rhyme-family lesson in a second
  // language, and the reason six sentences were already rewritten by hand.
  //
  // NO MECHANICAL LAW IS AVAILABLE HERE, and the near-misses are why. FOUR cards
  // use their character inside a compound their gloss does not name, and THREE
  // of them are CORRECT: 兔子 means rabbit, 蜂蜜 means honey, 蜜蜂 means bee, and
  // 奶奶 is the first sense 奶's own gloss states. The discriminator is MEANING,
  // not spelling, so a "the gloss must name the compound" scan would flag four
  // and be wrong on three — a fence around the residual, not a law. Those three
  // are named here so nobody "completes the pattern" by rewriting them.
  //
  // These two are restated instead, each with the reason it was wrong:
  const BANNED = [
    // Glossed "cow", with 🐮 on the front — and 牛奶 is MILK, so the sentence
    // demonstrated a different word from the one the card claims. It is the one
    // compound in the deck whose meaning diverges from its card's gloss.
    ["牛", "牛奶", "the card is glossed cow, but 牛奶 is milk"],
    // 口 is not a modern free noun for mouth — that is 嘴. It survives in
    // compounds (门口, 出口) and as a measure word (一口水). It shipped as
    // 我的口很小 by analogy with its four body-part siblings (我的头很大,
    // 我的牙很白, 我的心在跳, 我有两只手) and it is the one where the analogy
    // fails, because those four ARE free nouns and 口 is not. Same bookish-
    // standalone class as the 蜜 -> 蜂蜜 fix.
    ["口", "我的口", "口 alone is not the modern word for mouth (嘴 is)"],
  ];
  const deck = wcHanzi();
  for (const [ch, bad, why] of BANNED) {
    const card = deck.find((c) => c[0] === ch);
    assert.ok(card, `${ch} is no longer in the deck, so this law guards nothing`);
    assert.ok(card[5].indexOf(bad) < 0,
      `${ch}: the sentence "${card[5]}" is back to using ${bad} — ${why}`);
    // …and the positive half, or "teaches the right sense" would be satisfied
    // by a sentence that dropped the character altogether.
    assert.ok(card[5].indexOf(ch) >= 0,
      `${ch}: "${card[5]}" no longer contains the character it teaches`);
  }
});

test("Word Cards: the Chinese characters stay OUT of every English derivation", () => {
  // SIX derivations read WORDS — First Words, the word families, teamWords and
  // so every letter-team and bossy-r deck, the fourteen categories, and "Every
  // word" — and a han character satisfies the rules of none of them. Folding
  // the 120 into WORDS to save an array would have polluted all six at once;
  // keeping them apart is what makes that impossible rather than unlikely.
  const src = read("wordcards.html");
  for (const [w, pic] of wcWords()) {
    assert.doesNotMatch(w, /[一-鿿]/, `"${w}" is a han character sitting in WORDS`);
    assert.ok(typeof pic === "string", `${w} has no picture`);
  }
  const zh = new Set(wcHanzi().map((c) => c[0]));
  assert.ok(zh.size === 120 && wcWords().length > 400, "one of the two decks failed to parse");

  // …and the ONE-WAY rule in code: HANZI is read where its own deck is opened
  // and nowhere else. Comment-stripped, because the block above this array
  // explains the rule using its own name — this repo's most-repeated own goal.
  const bare = src.replace(/<!--[\s\S]*?-->/g, "").replace(/\/\*[\s\S]*?\*\//g, "")
                  .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
  const uses = (bare.match(/\bHANZI\b/g) || []).length;
  assert.equal(uses, 6,
    `HANZI is referenced ${uses} times; it may only be declared, counted for its own ` +
    "reading button and handed to that button's start(), counted for the WRITING " +
    "button and handed to writeDeck(), and walked by matchRounds() — a seventh " +
    "derivation reading it is how a han " +
    "character gets into a phonics deck. This count is the weak structural sibling of " +
    "\"the Chinese characters stay OUT of every English derivation\", which is the claim; " +
    "raise it only for a reader that is Chinese-only, and check that test still passes.");
});

test("Word Cards: a matching round cannot hold two answers for one picture", () => {
  // A matching BOARD asks a stricter question of the deck than reading it does.
  // A deck only needs NEIGHBOURS to differ; a board of four needs all SIX of
  // its pairs to, because two cards glossing one idea are two defensible
  // answers for one picture and the game has no way to accept the second.
  //
  // clash() already owned that question — it refuses a shared picture and every
  // declared PAIR — so the board reuses it rather than growing a second
  // ambiguity list next to it. Measured across all 7,140 pairs of the 120,
  // exactly six cases gloss the same idea and were NOT already refused, and
  // they go in PAIRS so the flash deck's adjacency gets the fix too. 蝴/蝶 needs
  // no entry: they share 🦋, which clash() catches by picture, and the picture
  // law next door holds them as a named exemption.
  const src = read("wordcards.html");
  const bare = src.replace(/<!--[\s\S]*?-->/g, "").replace(/\/\*[\s\S]*?\*\//g, "")
                  .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
  const lit = bare.match(/const PAIRS = ([\s\S]*?\]\];)/);
  assert.ok(lit, "PAIRS could not be parsed — the scan failed open");
  const pairs = new Function("return " + lit[1].slice(0, -1))();
  assert.ok(pairs.length >= 60, `only ${pairs.length} pairs parsed — the scan failed open`);
  const refused = new Set(pairs.flatMap(([a, b]) => [a + "|" + b, b + "|" + a]));

  for (const [a, b] of [["二", "两"], ["小", "少"], ["多", "几"],
                        ["看", "找"], ["来", "出"], ["回", "去"]])
    assert.ok(refused.has(a + "|" + b),
      `${a} and ${b} gloss the same idea, so a board holding both has two right answers`);

  // …and the round builder asks THAT gate rather than carrying its own. One
  // owner is the whole point: a second list is how the two come to disagree.
  const at = bare.indexOf("function matchRounds()");
  assert.ok(at > 0, "matchRounds() is gone — the board deals its rounds somewhere else now");
  const body = bare.slice(at, bare.indexOf("\n}", at));
  assert.ok(body.length > 80, "fixture: matchRounds' body was not sliced");
  assert.match(body, /clash\(/, "the round builder must ask clash(), not its own rule");
  assert.match(body, /teachingOrder\(HANZI/,
    "a round must be dealt from the seeded order, so the board he comes back to is the one he left");
});

// The page's PURE section — the data and every deck derivation, everything
// above its first DOM read — evaluated in node, so a rule about EVERY round can
// be checked over every round rather than the handful a browser walk reaches.
const wcPure = () => {
  const src = read("wordcards.html");
  const at = src.indexOf("const WORDS = "), end = src.indexOf("const $ = id =>");
  assert.ok(at > 0 && end > at, "the page's pure section could not be found — the scan failed open");
  return new Function(src.slice(at, end) +
    "; return { WORDS, sounds, firstWords, hearDeck, hearChoices, hearPool, " +
    "HOMOPHONES, HEAR_SKIP, HEAR_CHOICES, editDistance };")();
};

test("Word Cards: a listening round has exactly ONE right answer, and it takes reading to find", () => {
  // Hear it, find it SAYS a word and he taps it from three written words, so a
  // board is only fair if exactly one of them is what he heard: two words that
  // SOUND the same (to/two, be/bee) would be two right answers to a spoken
  // question, and the voice reads a word like "tv" as letters or a guess. It
  // only teaches reading if the wrong words LOOK like the right one — a wrong
  // word that differs in every letter can be found by its first letter alone.
  // Dealt over every round, in node, from the page's own rules.
  const P = wcPure();
  const deck = P.hearDeck(), pool = P.hearPool();
  const words = new Set(P.WORDS.map((w) => w[0]));
  assert.ok(deck.length >= 400, `only ${deck.length} rounds dealt — the ladder is not the whole deck`);
  assert.equal(new Set(deck).size, deck.length, "a word is dealt twice");
  assert.equal(deck.length, pool.length, "the ladder must deal every word in the pool, once");
  for (const [w] of deck) {
    assert.ok(w.length >= 2, `"${w}" is one letter — its spoken form is a guess`);
    assert.ok(!P.HEAR_SKIP.includes(w), `"${w}" is read aloud as letters, so it cannot be a spoken question`);
  }
  // Every exclusion must still name a real card, or it is a dead entry — and
  // a dead entry is how a future card slips past the rule it was written for.
  for (const x of P.HEAR_SKIP) assert.ok(words.has(x), `HEAR_SKIP names "${x}", which is no longer a card — delete the entry`);
  for (const [a, b] of P.HOMOPHONES)
    assert.ok(words.has(a) && words.has(b), `HOMOPHONES pairs ${a}/${b}, and one of them is no longer a card`);

  const alike = new Set(P.HOMOPHONES.flatMap(([a, b]) => [a + "|" + b, b + "|" + a]));
  const pos = new Array(P.HEAR_CHOICES).fill(0);
  for (const [w] of deck) {
    const ch = P.hearChoices(w);
    assert.equal(ch.length, P.HEAR_CHOICES, `${w}: ${ch.length} words on the board`);
    assert.equal(ch.filter((x) => x === w).length, 1, `${w}: the word he hears must be on its board exactly once`);
    assert.equal(new Set(ch).size, ch.length, `${w}: a word appears twice on one board (${ch.join(" / ")})`);
    for (const x of ch) assert.ok(words.has(x), `${w}: "${x}" is not a card`);
    for (let a = 0; a < ch.length; a++) for (let b = a + 1; b < ch.length; b++)
      assert.ok(!alike.has(ch[a] + "|" + ch[b]),
        `${w}: ${ch[a]} and ${ch[b]} SOUND the same, so the spoken question has two right answers`);
    assert.deepEqual(P.hearChoices(w), ch, `${w}: the board must be the same every time he meets the word`);
    pos[ch.indexOf(w)] += 1;
    // …and it takes READING: a short word always shares its board with a word
    // at most two letters away. Measured: 159 of 227 are one letter away.
    if (w.length <= 4) {
      const near = Math.min(...ch.filter((x) => x !== w).map((x) => P.editDistance(x, w)));
      assert.ok(near <= 2,
        `${w}: the nearest wrong word is ${near} letters away (${ch.join(" / ")}), so it can be found without reading it`);
    }
  }
  // POSITION must never answer the question. Measured 174 / 160 / 165.
  for (let k = 0; k < pos.length; k++)
    assert.ok(pos[k] >= deck.length * 0.25,
      `the answer sits in slot ${k + 1} on only ${pos[k]} of ${deck.length} boards`);
});

test("Word Cards: every pair a dictionary says SOUNDS alike is on the page's homophone list", () => {
  // The test above proves the HOMOPHONES list is OBEYED on every board, so it
  // can never see a pair the list forgot — and typed by hand the list forgot
  // one: fairy/ferry, which an American voice says identically, shared a
  // board twice (fairy's and ferry's). The game says the word and he taps it,
  // so both were right answers. So the list is checked against the CMU
  // Pronouncing Dictionary (tests/pronunciations.js): every word the game can
  // speak must have an entry, and every sound-alike pair in the pool must be
  // listed. Together with the test above, no two sound-alikes share a board.
  // Extra pairs are allowed: a merger the dictionary does not record (an
  // accent's cot/caught) is a fair thing to keep apart on purpose.
  const P = wcPure();
  const PRON = require("./pronunciations.js");
  const pool = P.hearPool().map((w) => w[0]);
  // A word said ON ITS OWN carries a primary stress (the "1"). A stressless
  // reading is a weak form of running speech ("are" -> "er") that the page
  // never says, and it would pair "are" with "or" for no reason. The stress
  // marks are then dropped: a spoken question cannot lean on them.
  const said = (w) => new Set((PRON[w] || []).filter((p) => /1/.test(p)).map((p) => p.replace(/\d/g, "")));
  const unchecked = pool.filter((w) => said(w).size === 0);
  assert.deepEqual(unchecked, [],
    `no dictionary entry for ${unchecked.slice(0, 8).join(", ")} — look each word up in the CMU Pronouncing ` +
    `Dictionary and copy its line into tests/pronunciations.js, so nobody has to remember whether it is a homophone`);
  const byPron = new Map();
  for (const w of pool) for (const p of said(w)) byPron.set(p, [...(byPron.get(p) || []), w]);
  const pairs = new Set();
  for (const ws of byPron.values())
    for (let a = 0; a < ws.length; a++) for (let b = a + 1; b < ws.length; b++) pairs.add([ws[a], ws[b]].sort().join("/"));
  // The dictionary must be able to SEE a homophone, or the law passes on
  // nothing. Measured, it finds 6 pairs in the pool (to/two, for/four, be/bee,
  // not/knot, red/read, fairy/ferry); readings that cannot match find 0.
  assert.ok(pairs.size >= 5, `the dictionary found only ${pairs.size} sound-alike pairs in the pool — it failed open`);
  const listed = new Set(P.HOMOPHONES.map((p) => [...p].sort().join("/")));
  const missed = [...pairs].filter((p) => !listed.has(p));
  assert.deepEqual(missed, [],
    `${missed.join(", ")} sound the same but are not in the page's HOMOPHONES, so they can share a listening board`);
});

test("Word Cards: the listening ladder opens on the words he already decodes", () => {
  // His profile: decoding 3- and 4-letter words is MASTERED and sight words are
  // his working edge. So the ladder opens on the First Words deck (confidence
  // first), then the Sight Words, then everything else by how many SOUNDS it
  // has — derived from decks this page already owns, never a hand-written list,
  // so a card added tomorrow lands on its own rung.
  const P = wcPure();
  const deck = P.hearDeck(), first = new Set(P.firstWords());
  const tier = (w) => (first.has(w) ? 0 : w[2] === "sight" ? 1 : 2);
  assert.ok(first.size >= 30, `only ${first.size} First Words — the ladder has no opening`);
  assert.ok(deck.slice(0, first.size).every((w) => first.has(w)),
    `the ladder must open on the ${first.size} First Words, not ${deck.slice(0, 6).map((w) => w[0]).join(" ")}`);
  assert.ok(deck.some((w) => tier(w) === 1) && deck.some((w) => tier(w) === 2), "fixture: a tier is empty");
  for (let k = 1; k < deck.length; k++) {
    const a = deck[k - 1], b = deck[k];
    assert.ok(tier(b) >= tier(a), `${a[0]} → ${b[0]}: the ladder steps back down a tier`);
    if (tier(a) === 2 && tier(b) === 2) {
      const sa = P.sounds(a[0]).length, sb = P.sounds(b[0]).length;
      assert.ok(sb > sa || (sb === sa && b[0].length >= a[0].length),
        `${a[0]} (${sa} sounds) → ${b[0]} (${sb}): past the sight words the ladder must climb by sounds, then length`);
    }
  }
  assert.deepEqual(P.hearDeck().map((w) => w[0]), deck.map((w) => w[0]),
    "the ladder must be the same every time, or a saved place points at a different word");
});

test("Word Cards: every grown-up HOLD on the page is the same gate", () => {
  // Going back to the first round throws away where he got to, so it sits
  // behind a HOLD — the gate RULE 5 names — on both boards now. One owner,
  // holdToAct(), because two copies of four listeners is how two gates come to
  // disagree: one still firing when the finger slides off, say. Derived from
  // the markup, so a third board's ⏮️ is covered the day it lands.
  const bare = read("wordcards.html").replace(/<!--[\s\S]*?-->/g, "").replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
  const ids = [...bare.matchAll(/class="icon hold" id="(\w+)"/g)].map((m) => m[1]);
  assert.ok(ids.length >= 2, `only ${ids.length} hold buttons found — the scan failed open`);
  assert.equal((bare.match(/function holdToAct\(/g) || []).length, 1, "holdToAct must be declared exactly once");
  for (const id of ids)
    assert.match(bare, new RegExp(`holdToAct\\(\\$\\("${id}"\\)`),
      `#${id} must be wired through holdToAct, the page's one owner of the grown-up gate`);
  assert.equal((bare.match(/holdToAct\(\$\(/g) || []).length, ids.length,
    "every holdToAct call must belong to a hold button in the markup");
});

test("Word Cards: the sound toggle is DERIVED, so a new screen cannot be forgotten", () => {
  // paintSound() looped a hand-written `[soundBtn, $("wsound")]`, which is the
  // population-by-hand class this repo pays for most often — and here the
  // symptom is the quietest kind there is: a third screen's button says "off"
  // while the one piece of state behind it says on, and nothing goes red.
  const src = read("wordcards.html");
  const bare = src.replace(/<!--[\s\S]*?-->/g, "").replace(/\/\*[\s\S]*?\*\//g, "")
                  .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
  const at = bare.indexOf("function paintSound()");
  assert.ok(at > 0, "paintSound() is gone");
  const body = bare.slice(at, bare.indexOf("\n}", at));
  assert.ok(body.length > 40 && body.length < 500, "fixture: paintSound's body was not sliced");
  assert.match(body, /querySelectorAll\("\.icon\.snd"\)/,
    "paintSound must DERIVE its buttons from the page, never hold a list of them");
  assert.doesNotMatch(body, /\bsoundBtn\b|\$\("\w*sound"\)/,
    "a named toggle inside paintSound is the hand-written list coming back");

  // ONE owner for the state itself. The three screens differ only in what there
  // is to SAY once sound is on, which is why that is the argument — a third
  // copy of the storage write and the repaint is exactly how two of them drift.
  assert.equal((bare.match(/localStorage\.setItem\("wc-sound"/g) || []).length, 2,
    "the sound state has exactly two writers: toggleSound(), and unmute() — the " +
    "deliberate unmute when he ASKS for audio (the word on the writing pad, or " +
    "opening the listening game, whose question is a sound)");
  // DERIVED from the markup, so a fifth screen's toggle is counted without anyone
  // editing a number here — this was the literal 4, which the listening game's
  // own toggle would have turned into a wrong claim.
  const toggles = (bare.match(/class="icon snd"/g) || []).length;
  assert.ok(toggles >= 4, `only ${toggles} sound toggles in the markup — the scan failed open`);
  assert.equal((bare.match(/toggleSound\(/g) || []).length, 1 + toggles,
    `toggleSound is declared once and called by each screen's toggle (${toggles} of them) — ` +
    "a screen that writes the sound state its own way is a second owner");
});

test("Word Cards: every character he WRITES has real stroke-order data", () => {
  // Writing a character in Chinese means writing its strokes in the right
  // ORDER — taught from the first day of school, and a habit that has to be
  // untaught if it is learned wrong. So the writing pad cannot invent this:
  // it reads scripts/hanzi-strokes.js, and a character with no entry there
  // would open a pad that can never be finished.
  const src = read("scripts/hanzi-strokes.js");
  const win = {};
  new Function("window", src)(win);
  const S = win.HANZI_STROKES;
  assert.ok(S && typeof S === "object", "hanzi-strokes.js must set window.HANZI_STROKES");

  const chars = wcHanzi().map((r) => r[0]);
  assert.ok(chars.length >= 100, `only ${chars.length} characters parsed — this check would be vacuous`);

  const missing = chars.filter((c) => !S[c]);
  assert.deepEqual(missing, [],
    `these characters are in the deck with no stroke data, so the writing pad could never finish them: ${missing.join(" ")}`);

  // The file is GENERATED from the deck, so it must also hold nothing else: a
  // stray character is 2KB of dead weight shipped to a phone, and a sign the
  // generator and the deck have come apart.
  const extra = Object.keys(S).filter((c) => !chars.includes(c));
  assert.deepEqual(extra, [], `stroke data for characters the deck does not teach: ${extra.join(" ")}`);

  let strokes = 0;
  for (const c of chars) {
    const d = S[c];
    assert.ok(Array.isArray(d.s) && d.s.length, `${c} has no stroke outlines`);
    // One median per outline, or the pad hints at a stroke it cannot judge.
    assert.equal(d.m.length, d.s.length,
      `${c} has ${d.s.length} outlines and ${d.m.length} centre-lines — the pad hints from m and inks from s, so they must pair`);
    for (let k = 0; k < d.s.length; k++) {
      assert.match(d.s[k], /^M[\s\d]/, `${c} stroke ${k + 1} is not an SVG path`);
      assert.ok(d.m[k].length >= 1, `${c} stroke ${k + 1} has an empty centre-line`);
      for (const pt of d.m[k]) {
        assert.ok(Array.isArray(pt) && pt.length === 2 && pt.every((n) => Number.isFinite(n)),
          `${c} stroke ${k + 1} has a malformed point ${JSON.stringify(pt)}`);
        // The data is authored in a 1024 box with y running UPWARD and a little
        // overshoot at the edges. A point far outside it means the file was
        // re-derived under a different convention and every hint would be off
        // the pad — the two-coordinate-spaces trap, one file over.
        assert.ok(pt[0] >= -300 && pt[0] <= 1324 && pt[1] >= -300 && pt[1] <= 1324,
          `${c} stroke ${k + 1} has a point outside the 1024 box: ${JSON.stringify(pt)}`);
      }
    }
    strokes += d.s.length;
  }
  assert.ok(strokes >= 600, `only ${strokes} strokes across the deck — the parse looks wrong`);
});

test("Word Cards: the say-it button's glyph is none of the deck's own pictures", () => {
  // 👂 and 👄 are BOTH pictures in this very deck — 听 (listen) and 口 (mouth) —
  // so either one as the say-it control would sit TWICE in the same row, once as
  // the answer and once as the button, which is the tile-icon law. That is live
  // rather than hypothetical: the ear was the first draft and only checking all
  // 120 pictures caught it. 🔊 is free as a picture and collides with the sound
  // toggle's own ON state instead, so the screen's other controls are checked
  // too. The comparison is wcSkel, this page's ONE definition of "these two
  // pictures are the same thing", rather than a second spelling of it.
  //
  // It walks EVERY say-it glyph, not the first: the listening game carries one
  // too, and its tile shows an ENGLISH card's picture as its reward — the "ear"
  // card's is 👂 — so it is checked against both decks' pictures.
  const src = read("wordcards.html");
  const ent = (t) => t.replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d))).trim();
  const says = [...src.matchAll(/<span class="wear"[^>]*>([\s\S]*?)<\/span>/g)].map((m) => ent(m[1]));
  assert.ok(says.length >= 2,
    `the writing pad and the listening game each carry a say-it glyph (saw ${says.length})`);

  const cards = [...wcHanzi(), ...wcWords()];
  assert.ok(cards.length > 600, `only ${cards.length} cards read — this clause would be vacuous`);

  // …and not either face of the sound toggle, the show-stroke button or the
  // grown-up's ⏮️, which sit on the same screens. The toggle's ON face lives in
  // paintSound, not the markup, so a scan that read only the HTML would miss
  // exactly the 🔊 case.
  const tog = src.match(/b\.innerHTML = soundOn \? "([^"]+)" : "([^"]+)";/);
  assert.ok(tog, "the sound toggle's two faces must be readable from paintSound");
  const show = src.match(/id="wshow"[^>]*>([\s\S]*?)<\/button>/);
  assert.ok(show, "the show-stroke button must be readable");
  const holds = [...src.matchAll(/class="icon hold"[^>]*>([\s\S]*?)<\/button>/g)].map((m) => ent(m[1]));
  assert.ok(holds.length >= 2, `both boards' grown-up ⏮️ must be readable (saw ${holds.length})`);
  const others = [ent(tog[1]), ent(tog[2]), ent(show[1]), ...holds];

  for (const g of says) {
    const say = wcSkel(g);
    assert.ok(say.length, `a say-it glyph did not parse: ${JSON.stringify(g)}`);
    const clash = cards.filter((c) => wcSkel(c[1]) === say).map((c) => c[0] + " " + c[1]);
    assert.deepEqual(clash, [],
      `a say-it button wears ${g}, which is also the card picture for ${clash.join(", ")} — on that card it appears twice, once as the answer and once as the control`);
    const dup = others.filter((o) => wcSkel(o) === say);
    assert.deepEqual(dup, [],
      `a say-it button wears ${g}, which is already a control on the same screen (${dup.join(" ")})`);
  }
});

test("Word Cards: the stroke data ships with the licence it is used under", () => {
  // It is a 120-character subset of an open dataset, not something this repo
  // authored, and the licence it arrives under requires the notice to travel
  // with it. A data file whose provenance is only in a commit message is a
  // licence obligation nobody can see.
  const lic = read("ARPHICPL.TXT");
  assert.ok(lic.length > 3000, `ARPHICPL.TXT is only ${lic.length} bytes — that is not the licence`);
  assert.match(lic, /ARPHIC PUBLIC LICENSE/, "ARPHICPL.TXT must be the Arphic Public License");

  const head = read("scripts/hanzi-strokes.js").slice(0, 2500);
  for (const claim of ["ARPHICPL.TXT", "hanzi-writer-data", "makemeahanzi", "ARPHIC PUBLIC LICENSE"]) {
    assert.ok(head.includes(claim),
      `the stroke data's header must name ${claim} — provenance that lives only in a commit message is invisible to anyone reading the file`);
  }
});

test("SHIP: every file that carries __BUILD__ is one the deploy rewrites", () => {
  // __BUILD__ is rewritten to the commit SHA at deploy time, and that is what
  // cache-busts an asset. A file that carries the token and is NOT in the sed
  // list ships the literal string: the asset is never busted, and RULE 6 calls
  // a stale cache the worst class of bug on a site like this. Derived, so a
  // third page or a versioned stylesheet is covered the day it lands.
  const fsx = require("node:fs");
  const shipped = [];
  for (const f of fsx.readdirSync(root)) if (/\.(html|js|webmanifest)$/.test(f)) shipped.push(f);
  for (const d of ["scripts", "styles"]) {
    for (const f of fsx.readdirSync(path.join(root, d))) if (/\.(js|css)$/.test(f)) shipped.push(`${d}/${f}`);
  }
  assert.ok(shipped.length >= 25, `only ${shipped.length} shipped files walked — this check would be vacuous`);

  const carries = shipped.filter((f) => read(f).includes("__BUILD__"));
  assert.ok(carries.length >= 2, `only ${carries.length} files carry __BUILD__ — the scan looks broken`);

  const yml = read(".github/workflows/deploy.yml");
  const sed = yml.match(/sed -i "s\/__BUILD__\/\$\{GITHUB_SHA::8\}\/g"([^\n]*)/);
  assert.ok(sed, "deploy.yml must carry the __BUILD__ rewrite step");
  const rewritten = sed[1].trim().split(/\s+/).filter(Boolean);
  for (const f of carries) {
    assert.ok(rewritten.includes(f),
      `${f} carries __BUILD__ but the deploy never rewrites it — it would ship the literal token and never cache-bust`);
  }
});

test("Word Cards: the writing ladder is DERIVED from the stroke count, not a list", () => {
  // 一 is one stroke and 蝴 is fifteen, so the printed table order would put a
  // 15-stroke character in front of a four-year-old on card ten. The ladder
  // that fixes that must come from the data: a hand-written order is the
  // "a list that outlives its contents" class, and it would go stale the first
  // time the deck changed.
  const page = read("wordcards.html");
  const fn = page.match(/function writeDeck\(\)\{[\s\S]*?\n\}/);
  assert.ok(fn, "wordcards.html must define writeDeck()");
  assert.match(fn[0], /strokesOf/,
    "the writing ladder must sort by the stroke COUNT — anything else is a hand-written order pretending to be derived");
  assert.match(fn[0], /HANZI\b/,
    "the writing ladder must be built from HANZI, so a character cannot be in one deck and missing from the other");
  // A tie has to keep the table's own order, or the ladder is unstable and a
  // card moves between visits for no reason the player can see.
  assert.match(fn[0], /\|\|\s*a\[1\]\s*-\s*b\[1\]/,
    "ties must fall back to the printed table's index, or the ladder is not stable");
});

test("Word Cards: simplified Chinese is asked for BY NAME, never inherited", () => {
  // This page's own family opens `ui-rounded, "SF Pro Rounded", "Hiragino Maru
  // Gothic ProN"`, and Hiragino Maru Gothic is a JAPANESE face sitting BEFORE
  // system-ui. So every han codepoint it covers would have rendered in Japanese
  // forms — 花, 海, 直 and 兔 all differ — while the simplified-only ones it does
  // not cover (车 门 鸟 马 红 绿 蓝) fell through it to whatever came next.
  //
  // This is the STRUCTURAL half: the face is declared and the JS marks the
  // language. What each element actually COMPUTES to is driven in e2e, because
  // a declaration proves nothing about which rule wins the cascade.
  const src = read("wordcards.html");
  const face = src.match(/--hz-face:\s*([^;]+);/);
  assert.ok(face, "the page declares no Simplified Chinese face, so han text inherits a Japanese one");
  const first = face[1].split(",")[0].replace(/"/g, "").trim();
  assert.ok(/\b(SC|GB|CN)\b/.test(first) || /PingFang|Heiti|YaHei/.test(first),
    `the first family in --hz-face is "${first}", which is not a Simplified Chinese face`);
  assert.doesNotMatch(face[1], /Hiragino Maru Gothic|Hiragino Kaku Gothic|Yu Gothic|Meiryo/,
    "--hz-face names a JAPANESE face — that is the defect it exists to avoid");
  // …and the language travels with the text, which is what gives VoiceOver a
  // Chinese voice on it as well as the right glyphs.
  assert.match(src, /setAttribute\("lang", "zh-CN"\)/,
    "nothing marks the character as Chinese, so the platform has to guess the script");
  assert.match(src, /u\.lang = lang \|\| "en-US"/,
    "speak() no longer takes a language, so a Chinese line is read with an English voice");
});

test("no test may measure page overflow against window.innerWidth", () => {
  // FOUND BY CHASING A MUTATION THAT PASSED. A deliberately broken layout —
  // `.wrap { min-width: 900px }` on a 390px viewport — sailed through a
  // brand-new "the deck must not scroll sideways" clause. It was not the
  // clause that was weak; it was the QUANTITY.
  //
  // Under `isMobile: true` (which most of this suite's contexts use, because
  // the app is a phone app) Chromium honours the meta-viewport and ZOOMS OUT
  // to fit overflowing content, so `window.innerWidth` follows the LAYOUT
  // width rather than the device. Measured on the fort's own page, in the
  // exact context tests/td.test.js builds, with a 1200px div appended:
  //
  //                     scrollWidth  innerWidth  clientWidth   ovf(inner)  ovf(client)
  //   plain                    1200         390          390         810          810
  //   hasTouch + isMobile      1200        1200          390           0          810
  //
  // So the metric reads ZERO on a page overflowing by 810px, and it does it
  // silently. `document.documentElement.clientWidth` is the device's own
  // width in BOTH cases and cannot be fooled that way.
  //
  // Four SHIPPED assertions were vacuous when this was written — the Word
  // Cards menu and deck (e2e, isMobile) and two in the fort's shared context —
  // and mobile.test.js was already correct at all three of its sites, which is
  // why the 240-game audits were never in doubt. This is the "assert X, not a
  // quantity that correlates with X" law landing on the suite itself.
  const dir = path.join(root, "tests");
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".test.js") || f === "helpers.js");
  assert.ok(files.length >= 6, `only ${files.length} test files found — the scan narrowed`);
  const bad = [];
  for (const f of files) {
    const src = fs.readFileSync(path.join(dir, f), "utf8");
    src.split("\n").forEach((line, k) => {
      // comment-stripped: this very test quotes the banned expression above,
      // and a scan must not count its own documentation.
      const code = line.replace(/\/\/.*$/, "").replace(/\/\*[\s\S]*?\*\//g, "");
      if (/scrollWidth\s*[-<>]=?\s*window\.innerWidth/.test(code) ||
          /window\.innerWidth\s*[-<>]=?\s*[\w.]*scrollWidth/.test(code))
        bad.push(`${f}:${k + 1}  ${line.trim().slice(0, 90)}`);
    });
  }
  assert.deepEqual(bad, [],
    "page overflow must be measured against documentElement.clientWidth — under isMobile the\n" +
    "browser zooms out to fit, so innerWidth follows the overflow and the check reads 0:\n  " +
    bad.join("\n  "));
});
