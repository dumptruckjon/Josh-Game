# CLAUDE.md

Guidance for AI assistants (and humans) working in this repository.

**Josh's Games** is a fun, personal GitHub Pages website: a collection of big,
friendly, no-fail little games for **Josh, age 4**. The goal is delight — keep
it playful, simple, forgiving, and always shippable.

- **Live site:** **https://dumptruckjon.github.io/Josh-Game/**
- **Repo:** `dumptruckjon/Josh-Game` (public)
- **Hosting:** GitHub Pages, auto-deployed from `main` via GitHub Actions.

This project was bootstrapped from the learnings of the **Mo** site
(`dumptruckjon/Mo`) — same plain-static-site + tests + CI recipe, retuned for a
preschooler.

> 📇 **Know your player — read [`JOSH_PROFILE.md`](JOSH_PROFILE.md) first.** Before designing or tweaking
> any game, read **`JOSH_PROFILE.md`** (human brief) / **`josh-profile.json`** (same data, machine-readable).
> It defines **who Josh is and what to build**: his real skill levels (Mastered / Working / Presented, from
> his June 2026 Montessori assessment — so games land at the right difficulty), the non-reader design law,
> his friends & interests to personalize with, a skill→game-mechanic menu, and what to avoid. Think of it as
> the *"what to build & how hard"* companion to this file's *"how to build & ship."* Keep it PII-clean —
> first names only (see the privacy note inside).

---

## ⚠️ PROJECT RULES — NON-NEGOTIABLE

These rules are mandatory for **every** change, no exceptions. They override
convenience. If a rule cannot be followed, STOP and tell the user why instead of
silently skipping it.

### RULE 1 — Always ship to `main` on GitHub
Every change, no matter how small, MUST be committed and **pushed to `main`** on
GitHub before the task is considered done. `main` is the single source of truth
and the branch GitHub Pages deploys from. Do not leave work uncommitted, on a
side branch, or local-only. One change → one commit → pushed to `main`.

### RULE 2 — Validate and verify everything; never ship a regression
Before every push you MUST prove the change works and breaks nothing:
1. **Run the full test suite** (`npm test`) — this runs the unit tests AND the
   **Playwright browser tests** (e2e + mobile), and it must pass.
2. **Actually exercise the behavior in a real browser.** Clicks and functions
   must be proven to work — not assumed from reading code. `tests/e2e.test.js`
   loads the page in Chromium and taps the interactive toys; an edit to any
   interactive behavior is NOT complete until a browser test drives it and
   passes.
3. **Watch the deploy** after pushing: confirm the GitHub Actions run goes green
   and the live site reflects the change. A push is not "done" until the deploy
   succeeds.
Treat any break or regression as a stop-the-line event.

### RULE 3 — Always add test cases (unit AND browser)
Every change MUST include or update tests in `tests/`:
- **Content/logic** → assertions in `tests/site.test.js`.
- **Any interactive behavior (a tap, toggle, animation trigger)** → a Playwright
  test in `tests/e2e.test.js` (and `tests/mobile.test.js` for touch/layout) that
  performs the action and verifies the result in the DOM.
New feature → new tests covering it. Bug fix → a test that would have caught the
bug. Never add functionality without a corresponding test.

### RULE 4 — Every reply includes a clickable link to the live site
**Every single response** Claude sends in this project MUST end with a clickable
Markdown link to the live site:

> 🔗 **[Play Josh's Games](https://dumptruckjon.github.io/Josh-Game/)**

This applies to every message — answers, status updates, questions, errors —
without exception.

### RULE 5 — Built for a 4-year-old on a touch screen, always
Josh plays on a phone/tablet, so the site MUST look and work great in **iOS
Safari** and be forgiving of little hands on every change.
**PORTRAIT IS THE MODE (owner directive, 2026-07): every world here is played in
portrait, so optimize fully for portrait, always.** Landscape must keep WORKING
— it is still tested, and a rotation must never break or overflow anything — but
it is not a design target: when the two trade off, portrait wins every time, and
a layout must not pay portrait pixels to make landscape nicer. The fort's own
portrait law (full-bleed field, one control row) is guardrail-locked in
`tests/td.test.js`.

The touch laws:
- **Tap targets ≥ 75px**, generous spacing (≥ 16px); whole-card tap zones, not
  small buttons. (Adults get 44px; a preschooler needs much bigger.)
- **Zero reading required.** Icons, emoji, color, and (gesture-gated) audio
  cues carry the play; any text is for the grown-up.
- **No failure states.** Nothing buzzes, scolds, or resets progress. Wrong moves
  simply don't exist here — celebrate everything; confetti is free.
- **No timers** (or hidden, gentle ones). Josh plays at his own pace.
- **No rapid-tap or precision-timing mechanics.** Favor: tap-the-thing,
  drag-anywhere-near (huge tolerance), sort-by-color/shape, simple cause→effect
  toys, find-the-animal.
- **Multi-touch forgiveness:** ignore extra/secondary pointers; never require a
  multi-touch gesture.
- **iOS Safari specifics:** `100dvh` (not bare `100vh`); `env(safe-area-inset-*)`
  for the notch (`viewport-fit=cover` is set); `-webkit-` prefixes where Safari
  needs them; `touch-action: manipulation` and
  `-webkit-tap-highlight-color: transparent` on every tappable element.
- **No animated full-page background** — iOS repaints on scroll and it flashes.
  Static gradient + small animated elements only.
- **Sound off by default.** A giant, obvious mute toggle; audio only after a
  user gesture; respect `prefers-reduced-motion` everywhere.
- **Guard against accidental exits.** PWA standalone (add to home screen) hides
  the URL bar; no external links anywhere; nothing destructive without a
  "parent gate" (e.g. a long-press).
- **Prove it:** `tests/mobile.test.js` runs on **real WebKit (Safari's engine)**
  when available (CI installs it), falling back to Chromium iPhone-emulation
  locally. It audits no-overflow at 390px AND 320px and the ≥75px tap sizes. It
  must pass.

### RULE 6 — Never ship broken or unvalidated; verify the LIVE site
Tests passing on local files is NOT proof the deployed site works. A change is
"done" only after the **actual live URL** has been verified in a real browser.
- **Cache-bust every asset.** Asset URLs in `index.html` (and the cache name in
  `sw.js`) carry the `__BUILD__` token, which the deploy job rewrites to the
  commit SHA. Never reference a JS/CSS asset without the `?v=` version query, and
  the SW cache name bumps every deploy — stale caches are a shipping bug (this is
  the single worst class of bug on a site like this: new features pass every
  local test but are dead on the real device because the browser/service worker
  served old JS).
- **Verify the deployed site, not just local files.** CI's `verify-live` job
  waits for the live URL to serve the new commit, then runs the full browser
  suite (Chromium **and** WebKit) against the **live** URL via `JOSH_BASE_URL`.
  A red `verify-live` means the deploy is broken even if `test` was green — treat
  it as a stop-the-line failure.
- **Don't claim "verified live" from the sandbox.** The agent sandbox can't reach
  `*.github.io`; rely on the `verify-live` CI job for live proof, and ask the
  user to confirm on the real device for pixel-level Safari quirks.
- **Isolate features.** Each feature init is wrapped in try/catch so one failure
  can't silently kill the rest of the page.

### RULE 0 — Do not defer. Keep working.
Owner directive (2026-08), after this happened repeatedly: **never end a turn
with a list of "what's still open" while any item on that list is actionable
right now.** Pick the next one and do it. The list belongs in this file and in
commit messages, not in a reply.

Specifically:
- A measurement that produces a NEGATIVE result is not the end of the task — it
  eliminates one option. Move to the next option in the same turn.
- "This is a content pass to commission" / "a deliberate balance pass" / "worth
  doing next" are all deferrals unless the owner has actually declined the work.
  If it is actionable and not yet refused, DO it.
- Waiting on a background gate is not a reason to stop. Start the next piece of
  work while it runs; a red gate is fixed forward when it lands.
- Report in ONE or TWO lines. Findings go in the commit message and here, where
  they survive; a long status reply is how a turn ends without work in it.
- The only legitimate stops: the work is genuinely finished, a decision is truly
  the owner's to make and blocks everything, or something is unsafe.

### RULE 7 — Self-healing: every fix becomes a systemic guardrail
This project must get **better and harder to break over time**. So whenever you
find a bug, a footgun, or a new learning, you MUST wire it up so it applies to
**every existing game AND every future one** — never a one-off patch:
1. **Centralize the correct way.** If a game did something subtle wrong, move the
   correct implementation into a shared place so no game re-implements it (e.g.
   all WebAudio goes through `JoshAudio.tone()` — the ONE iOS-safe path — never a
   per-game `AudioContext`).
2. **Add a guardrail test that fails if the pattern ever returns** — ideally a
   *generic* one that scans every game, not a single-case check. The self-healing
   guardrails live at the end of `tests/site.test.js`; the generic contract is
   enforced by `e2e.test.js` (plays every game) and `mobile.test.js` (audits
   every screen). Adding a game auto-inherits all of them.
3. **Write down the learning here** so the next author starts ahead.
Known learnings already wired: iOS WebAudio must resume() **before** scheduling a
note (silent otherwise) → centralized in `JoshAudio.tone` + guardrail; the
every-game harness must drive taps with a DOM `el.click()` (a coordinate/force
click misses under CPU load when a field reflows) → enforced by a guardrail;
naming-task pictures must name themselves; sort/first-sound/rhyme/etc. truth is
restated in `content.test.js`; games must never concatenate a fixed article before
a dynamic word (`"a " + name` → "a Island") — use `JoshLogic.article(word)` (picks
a/an by sound) → generic guardrail; a game screen must **fill the viewport and
centre its play** (no dead bottom half) and cards shouldn't be flat white →
centralized in the shared stage CSS + `api.mascot()`, both guardrail-locked;
**wins were silent** — sound feedback (a rising win jingle, a confirming
round tone, a soft non-punishing try-again bump) is now centralized in
`JoshAudio.winCue/goodCue/bumpCue` (mute-gated so "sound off" truly silences
them, routed through the one iOS-safe `tone()`) and fired from the framework so
every game inherits it → guardrail-locked; **the `josh-won-*` "beaten" flags had
three writers** (framework win, launcher, reset gate) — they now have ONE owner,
`JoshProgress` (in `stickers.js`), which the ⭐ badges, the 📖 Sticker Book, and
the grown-ups reset all read/write through → guardrail-locked;
**a running total must update on the action that COMPLETES the task**, not only
on the not-yet-finished branch (Piggy Bank's worth display refreshed only while
the piggy wasn't full, so the coin that filled it left the total frozen one coin
short, e.g. "4¢ / 5¢") → e2e regression test that fills a round and asserts the
display reaches the full price; **a puzzle whose answer is read off a drawn scene
must keep that scene UNAMBIGUOUS** — no foreground element may hide information
the answer depends on (Look From Above's random block heights let a tall front
block fully occlude the back cell in the isometric view, making the footprint
indeterminable; fixed to uniform single-cube height, and the top-down map is now
a diamond that matches the scene's orientation instead of a 45°-rotated grid) →
logic guardrail asserting every block is height 1;
**personalization has ONE owner** — `JoshBuddy` (in `buddy.js`) owns the
`josh-buddy` token and is the single source for the home companion AND the win
celebration art, so the "which character represents Josh" choice can never
disagree between the two → guardrail-locked;
**a win's celebration pop (`.win-hero`) outlives its round by 1700ms** — a quick
"Again" (or a rapid re-win on the same screen) left the PREVIOUS pop hovering
over the fresh round, and `querySelector(".win-hero")` grabbed the STALE one
(a different buddy's art) — the root of a recurring buddy-test flake → the
framework's `start()` now removes any lingering `.win-hero` on (re)start, and
the buddy test reads the LAST pop atomically with the won flag;
**every game must be winnable/collectible** — the 4 endless toys (Hi Animals,
Peekaboo, Music Pad, Thwip the Villains) only ticked plays and never called
`api.win()`, so their Sticker Book slots could never fill (star meter stuck
below 100%); each now earns its sticker once after a few taps (click-count,
never a timer) then keeps playing → the generic e2e harness now drives EVERY
game to a win (tap `[data-correct]` if present, else a live `[data-toy]`), so a
future un-winnable game fails the suite.
**a quiz can "win" in the harness while marking a genuinely-CORRECT tap wrong** —
the tap-harness trusts `data-correct`, so it can't catch a *true* answer being
rejected. A deep 140-game audit found three: a lone-animal continent quiz whose
signature animals (eagle/deer) had multi-continent ranges (→ single-continent-
iconic bison/hedgehog + guardrail banning multi-continent animals); a letter
match placing iOS-identical "I"/"l" together (→ `makeLetterMatch` never pairs a
confusable group + guardrail); and a 量词 quiz offering 只 (valid for one shoe)
as a "wrong" answer for 鞋 (→ `alsoOk` list excluded from distractors + a PAIR
emoji + guardrail). Lesson: for any pick-the-answer game, prove NO distractor is
also correct, restate the truth in `content.test.js`/`hl-content.test.js`, and
remember visual/platform rendering (a dotless "i") is part of correctness.
**a rotating multi-domain tile must name each round's question** (science-sort
runs alive/sink-float/plant-animal under one prompt → each set now carries its
own `prompt`+`icons`); **a tile title must match the round** (找福字 now always
hunts 福 via `makeLetterHunt` `opts.target`); **a named mechanic must BE that
mechanic** (四宫数独 was a Latin square → `makeSudoku4` enforces real 2×2 boxes,
guardrail-tested, separate from `makeLatinSquare` so Josh's picture-squares is
untouched); **a countdown/among-a-set answer should be visible, not audio-only**
(Team Countdown now shows a live 5→4→3→2→1 numeral).
**A wrapped row of word/piece TILES must keep ≥16px between buttons** — Build the
Sentence first shipped with a 10px tile gap and the 320px audit's ≥14px
spacing rule failed it (only `button`/`a`/`[role=button]` are audited, so spans
are exempt but real tile buttons are not); every flex/grid of tappable tiles now
uses the shared 16px gap. **A named-place tap game (absolute-positioned zones on
a figure) must prove its geometry, not eyeball it** — Simon Says: Touch! carries
a `BODY_FIGURE_BOX` and a `content.test.js` geometry test that restates the
mobile math (80px zones on a 240×400 box, every pair ≥14px apart, all inside the
box), the FU_PATH precedent, so a future zone nudge can't silently collide.
**A "who eats/uses this?" quiz must list EVERY plausible eater so no distractor
is also-correct** — Who Eats This? uses mutually-exclusive kid-canon diets
(rabbit-carrot, dog-bone, panda-bamboo, monkey-banana, squirrel-acorn,
mouse-cheese) with a guardrail asserting no other food's answer is a valid eater
of a given food (the generalized `alsoOk` discipline).
**An emoji newer than Emoji 13.0 is INVISIBLE on Josh's iPad** (iOS 14.2 floor)
but renders fine in CI's desktop Chromium/WebKit — so tofu (□) ships green. A
deep audit found 14 such emoji live (🫧 bubbles, 🛟 buoy, 🫙 jar, 🛝 slide, 🫗
pour, 🪷 lotus ×7, 🪭 fan), several the *entire* tappable surface of a game. All
replaced with ≤13.0 equivalents, and a GENERIC guardrail in `site.test.js` now
scans every script for code points in the 13.1/14.0/15.x ranges and fails if any
returns — so no future game (Set 2 included) can ship a blank picture. When you
add an emoji, keep it Emoji ≤13.0.
**A distractor drawn from a DIFFERENT taxonomic level is also-correct** — Whose
Tracks? offered 🐦 (generic bird) as a distractor against 🦆 (duck), but a duck
IS a bird, and the duck's "web" print was drawn as a plain three-toed fan
identical to a songbird's; fixed by dropping the generic bird, drawing the duck's
web with a real membrane, mapping the cloven print to a 🦌 deer (not a
single-hoofed 🐴 horse), and a guardrail banning 🐦+🦆 as co-answers. Same lesson
for phonics: **the ending LETTER is not always the ending SOUND** — "fox"/X was
keyed as an ending sound but ends in /ks/ (so a defensible "S" tap was bumped);
replaced with "sock"/K, where the letter genuinely spells the final sound. When
you fix the next thing, extend this list.
**Set 2 added six new interaction shapes — each got ONE normative implementation
so no game re-invents it** (RULE 7): **pick-and-place** (mechanic A) has a single
`.held` machinery — exactly ONE `data-correct` at a time (held=null flags every
un-placed pick; once held, the flag MOVES to the matching empty slot), debuted in
Set the Table and copied verbatim by Match Them All / Team Puzzle; **toggle-to-match**
(mechanic B) shares one `toggleGrid()` engine where cells only ever move TOWARD
the model (matching cells never toggle away, so progress can't be broken and the
harness always converges); **progressive reveal** (mechanic C) keeps the peek
control UN-flagged and the answer chips flagged from round start (self-paced, no
timer); **co-op echo** (mechanic D) and **path-choice** (mechanic F) likewise
route through shared helpers. **A toy that DISABLES a consumed control must also
drop its `[data-toy]`** — the every-game harness taps the FIRST `[data-toy]` and
`el.click()` on a disabled button silently no-ops, so a disabled-but-still-tagged
toy strands the harness forever (the Worry Box hit this; fixed by `delete
b.dataset.toy` on tuck — the "webbed baddie is consumed" pattern). **An
all-answers-valid game must be a TOY, never a flagged quiz** — Thank-You Hearts /
Partner Up have no wrong answer, so they use the `[data-toy]` + win-at-N contract
(mixing flagged-wrong chips into an all-valid game would be a lie). **A note
played with a scheduled offset needs a real scheduler** — `JoshAudio.tone()` only
plays at `currentTime`, so Team Song's playback staggers notes with `setTimeout`,
not a non-existent `when` option (celebration only — never gate gameplay on a
timer). **A row of buttons whose GLYPHS differ in size must force equal columns**
— `repeat(3, 1fr)` is `minmax(auto,1fr)`, so a big-glyph button steals track width
and starves a small-glyph sibling below 75px (Will It Fit?'s size-comparison row
dropped the tiniest toy to 74.7px); the size difference must live in the GLYPH,
never the tappable box, so its row uses `repeat(3, minmax(0,1fr))` (the
smallest-hunt lesson, now applied to fits-inside). **A "lit/selected" cue must not
be a `transform: scale()` on a gapped grid** — scaling a pad up encroaches on the
inter-tile gap and can drop it below the 14px audit floor (Copy Me!'s lit pad hit
13.4px); use a `box-shadow` ring instead — it paints outside layout, so the
measured gap is unchanged.
**A contentless square sized ONLY by `aspect-ratio` collapses to a sliver on
Josh's iOS 14.2 iPad** — Safari 14 has NO `aspect-ratio` (added in Safari 15),
and CI's modern WebKit/Chromium hides it, so the toggle-grid cells (`.tg__cell`,
shipped with `min-height: 0`) rendered as invisible untappable strips on the real
device. A 6-lens adversarial audit of Set 2 caught it; the fix pairs every
aspect-ratio cell with a real height fallback (`min-height: var(--tap)` / a value
≤ the cell width so modern browsers keep the square), and a GENERIC `site.test.js`
guardrail now scans every CSS rule and fails if an `aspect-ratio` cell has no
`min-height`/`height` fallback — which immediately surfaced three MORE latent
collapses (`.sudoku__cell`, `.story__slot`, `.mtx__cell`), all fixed. When you add
a square cell, pair `aspect-ratio` with a min-height.
**A category game must SPEAK an umbrella term true for EVERY member** — Count the
Animals labeled the vehicles set "cars and trucks", but the pool holds a plane, a
bike and a tractor, so it counted them as "cars and trucks" aloud (a lie to a
non-reader whose audio is the instruction); the label moved into `content.js`
(`FIND_CATEGORIES[].name = "things that go"`) and a `content.test.js` truth test
pins it. **A pick-and-place game that DEFERS its next round must clear
`data-correct` before the timer** — Partner Up! left the just-paired (disabled)
duck flagged through a 950ms `setTimeout(newRound)` gap, and the every-game harness
spun on the disabled `[data-correct]`; `finish()` now clears all duck flags first
(the sibling mechanic-A games avoided it only because they rebuild the round
synchronously).
**A scene stage whose children are ALL `position:absolute` collapses to width 0
inside a shrink-wrapping flex parent** — Set 3's scene-zone games (Shape Spy,
Hide & Seek) place `≥75px` zone buttons at `left/top` percentages inside a
`.scene__stage`; the launcher's game stage is `display:flex; align-items:center`,
so a `.scene__stage { width: 100% }` resolved its `100%` against a parent that
shrink-wrapped to the stage's own (zero, all-absolute) content → **every zone
piled at x=0 and overlapped**. The unit geometry test (which checks the `x%·box.w`
math) passed while the RENDER was broken — only the one-pass 320px auditor caught
it. Fix: give a scene stage an EXPLICIT width (`width: 280px; max-width: 100%`),
never a `%` that depends on a shrink-wrapping ancestor, and set the content box's
`w` to that real render width so the geometry test matches reality. New RULE-7
tooling: a one-pass auditor (`scratchpad/audit-all.js` pattern) that walks every
screen and reports ALL 320px violations at once beats the suite's stop-at-first —
run it after any layout change. **Set 3 added seven interaction shapes, each with
ONE normative implementation** (RULE 7): acted-story math (Duck Pond — spoken +
concretely countable, the profile-legal word problem), pulse-count (Drum the Word
— a self-paced ▶ control stays UN-flagged, the answer chips flagged from start),
stretch-and-blend (Robot Talk — dual channel: tones + letters lighting in order,
so it's playable muted), multi-fork traversal (Drive Home), scene-zone tap
(shared `sceneZones` helper + per-scene geometry truth tests — the BODY_FIGURE_BOX
precedent generalized), excavate-then-identify (Dino Dig — every un-brushed patch
stays flagged so the harness converges, then silhouette-distinct ID chips), and
align-and-count measurement (How Tall — the flag clears on the completing unit,
the piggy-bank law). **A "what's missing" picture proves its parts by DIFF** —
`content.test.js` asserts `JoshArt.fixable(scene, partKey)` is shorter than the
full drawing, so a renamed/removed SVG part can't silently make the answer
un-drawable.
**The Set-3 adversarial audit caught five real ship-blockers the suite passed
over** (the harness taps flagged answers, so it can't feel a broken *reveal* or
hear a wrong *sentence*): (1+2) **a self-paced ▶ reveal control must actually be
wired to its `play()`** — Drum the Word and Robot Talk had only a `pointerdown`
audio-unlock listener and NO `click` handler, so the pulse-dot / letter-lighting
channel (the sanctioned sound-off path) was DEAD until after a correct guess;
fixed with `el.addEventListener("click", play)`. (3) **a spoken analogy question
must keep C the SUBJECT** — goes-with composed `"What " + relation + " " + c`
("What eats monkey?"), inverting every directional relation against the correct
answer, and since `JoshAudio.say` cancels the queued prompt, the inverted line
was the ONLY thing voiced; now `"<c> <relation> what?"` ("monkey eats what?").
(4) **a pick-and-place home must be picture-unambiguous AND spoken** — Tidy Up's
generic 📦 box vs 🧺 basket made a ball↔box / block↔basket placement an
also-valid coin-flip a non-reader couldn't read; fixed to non-overlapping homes
(toys→box, books→shelf, art→cup, CLOTHES→laundry) and the game now SPEAKS the
destination on pickup. (5) **a food-origin distractor that is a REAL source is
also-correct** — 🐑 was offered as a wrong answer for 🥛 milk though sheep milk
is real; 🐑 added to milk's `users` (never a distractor) + a guardrail. Lesson:
after building an audio- or reveal-driven game, drive its ▶ control and *listen
to the sentence* — the tap-harness proves winnability, not instruction sanity.
When you fix the next thing, extend this list.
**The offline PWA booted as a DEAD SHELL** — the service worker precaches the
UNVERSIONED asset paths (CORE lists `./scripts/main.js`) but `index.html` requests
every asset with the `?v=<sha>` cache-bust query, and `caches.match` is
query-sensitive by default, so offline the versioned script requests MISSED the
precache and fell through to the `index.html` fallback → the browser parsed HTML
as JavaScript (`Unexpected token '<'`) and the home painted with **zero scripts
running** (empty `window.JoshGames`). A first-offline-open (exactly how a
home-screen PWA is used on a car ride) was broken, and the whole test suite was
green because **nothing tested offline**. Fix: the SW offline fallback now retries
`caches.match(req, { ignoreSearch: true })` before the HTML fallback, so an
unversioned precache entry satisfies a versioned request (safe — `?v=` only busts
the cache; the file at a path is identical across versions, and network-first
keeps things fresh whenever online). Guardrails: a generic `site.test.js` check
fails if the SW fallback loses `ignoreSearch`, and a new `tests/offline.test.js`
drops the network in a real browser and asserts the app FULLY boots from cache
(home visible **and** `JoshGames` present **and** no `'<'` SyntaxError), including
a precache-only path. Lesson: an asset that is cache-busted with a query in the
page MUST be resolvable without that query in the offline cache — and "works
offline" is only true once a test actually pulls the plug.
**A toddler double-taps EVERYTHING — and the whole suite drove every game with
single, polite clicks**, so three real hammer-tap bug classes shipped green: (1)
`api.win()` had no idempotence guard and most game handlers judge CLOSURE state,
not the DOM, so a doubled final tap ran the whole win path twice (two buddy pops,
double jingle) in ~51 games — guarded once in `framework.js` so every game
inherits; (2) all six pick-and-place games' `.held` machinery TOGGLED the held
item back out on a second tap (pick→unpick = net nothing; a hammer-tapping kid
gets a dead-feeling hand) — now a double-tap keeps holding (switching = tap a
different item, unchanged); (3) three interaction-specific traps: `set-clock`'s
mover advanced 2 hours per doubled gesture and an odd distance NEVER lands (wrap
preserves parity) → the mover disables once aligned; the echo games judged the
doubled re-hit of the just-correct drum as WRONG and wiped the whole echo → a
same-drum re-hit within 350ms is forgiven (a true in-sequence repeat is judged
correct first, so forgiveness only eats the hammer-tap); `team-bridge`/
`pattern-fix` double-advanced into `slots[GOAL]`/a rebuilt row → TypeError →
guarded. Guardrail: an e2e "toddler chaos" test drives all 12 affected games to
a win DOUBLE-clicking every target and asserts exactly one celebration pop. The
same audit proved the good news systemically: 240/240 abandoned-mid-round games
leave ZERO unearned stickers (stale timers can't corrupt the Sticker Book),
every game wins a SECOND time after Again (no stale state), storage-BLOCKED
Safari (private mode) still boots and plays, junk hashes and phone back/forward
are safe, and landscape has no overflow. Lesson: drive games the way a
4-year-old actually taps — doubled, abandoned, replayed — not just the way the
contract expects; closure-state handlers + rebuilt DOM is where those bugs hide.
**Fort Josh's first deep audit found two DEAD engine features and two tier-4
tooltips that read as downgrades — all green, because a real-time TD's *feel*
isn't a `data-correct` tap.** (1) **A non-default targeting mode must actually
re-evaluate** — the dart's strong/last/close modes were honored ONLY at the
instant of target acquisition, then sticky-kept, so a stronger/closer enemy
entering range was ignored and the mode sat inert (~60% of sampled ticks locked
on a strictly-weaker enemy); only `first` stays sticky by design (no thrash), the
rest now re-pick every tick like fan/mortar already did → guardrail samples a
whole wave and fails if dart-on-`strong` sits on a weaker enemy while a UNIQUE
strongest is in range. (2) **A rally issued mid-combat must update an ENGAGED
soldier's post** — the old `&& !sol.engagedId` guard skipped exactly the soldiers
you're repositioning (the ones fighting), so a wall couldn't be re-formed under
pressure; now every living soldier's post updates and it marches there once it
disengages (the engaged branch still `continue`s, so it keeps fighting first) →
guardrail rallies an engaged soldier and asserts its post moved. (3) **A tier-4
branch must never read as a straight DPS downgrade from the tier-3 it replaces**
— Sticky Bomb (46 dmg vs Crate Cannon's 58) and RC Racers (squad DPS 40 vs Elite
Platoon's 45.88) each looked like a nerf on the tooltip; bumped to match-or-beat
(Sticky 60; RC 9 → squad DPS 51.4) → guardrail over a NAMED damage-role branch
list, with the deliberate tank/utility sidegrades (Dino Squad's HP+double-block,
Blizzard/Static's brittle/chain) explicitly exempted so the exemption is
intentional, not an accidental hole. (4) **A difficulty the engine fully supports
but nothing can select is a dead feature** — casual/normal/heroic
(hp/speed/bounty/start-gold multipliers) shipped working in the engine but
`startLevel` hardcoded `"normal"`, so heroic was unreachable; wired to a persisted
fort-home selector (😌 Easy / ⚔️ Normal / 💀 Hard) → browser guardrail picks Hard
and asserts `createEngine` receives `"heroic"` and it persists to the save. Same
audit added premium-TD readability the tap-harness never needed: build-menu ROLE
labels (single-shot / splash / slows / blocks path), a tower-panel stat line
(dps · range · splash · crit, or slow%/aura, or bodies×hp · dps), and a
next-wave enemy preview during build. Lesson: for a real-time game the
tap-harness proves it RUNS, not that every stat lever and targeting mode is LIVE
— audit a deterministic engine by driving it headless and reading the numbers,
then pin each fix with a node-sim or `__TD` guardrail.
**Fort Josh's UX/art pass fixed four "feel" defects the numbers-only tests
couldn't see — each turned into a systemic rule.** (1) **A progress-losing exit
must confirm first** — the in-game 🏠 (and the pause menu's "Back to the fort")
dumped you to the fort mid-battle with one tap; both now route through a shared
`UI.confirm` ("Leave the battle?") whenever a level is LIVE (build/wave phase),
with "↩ Keep playing" as the prominent default and the battle paused while you
decide → browser guardrail taps 🏠 mid-wave and asserts Keep-playing stays on
`#td-play` while Leave navigates to `#td-home`. (2) **A dialog must fit even with
iOS-wide emoji** — the tower panel's stats line was `white-space: nowrap`, and
iOS renders 🪖/❄/💥 WIDER than desktop Chromium, so the line spilled off the
right on the real device while every headless measure "fit". Fix is belt-and-
suspenders: CSS caps the bubble at `calc(100vw − 16px)`, the stats line WRAPS,
and the JS clamp now measures the widest CHILD edge (not just the box) and
re-clamps on the next frame (real-device layout settles a tick late) → the
dialog-fit guardrail now also opens a tier-3 PANEL on edge pads and checks the
widest ink edge, at 320 AND 390. (3) **The renderer draws CHARACTERS upright in
screen space** — only the FLOOR (bg/path/pads) rotates 90° to fill portrait;
towers/enemies/soldiers/projectiles are drawn via `worldToScreen` in an
unrotated context, so a sock's face and a turret's barrels are never sideways
(they were, in portrait). Any future entity art inherits upright orientation for
free. (4) **Block soldiers line up ALONG the path** — rally slots used fixed 2D
offsets that scattered soldiers off the ribbon; they now spread along the path
TANGENT (computed from `posAt`), so the squad stands ON the lane as a visible
wall → engine guardrail asserts every soldier post sits within 0.5 cell of the
path centre-line for every camp-able pad. Plus a render fix the neglect-sim
surfaced: **a full-screen flash fx must REFRESH, not stack** — a burst of leaks
piled translucent rects into an opaque red wall; one leak flash now refreshes its
ttl instead of pushing another. Lesson: a real-time game's *feel* (an accidental
exit, a dialog that spills only on iOS's wider emoji, art that's sideways in one
orientation) lives outside the tap/number tests — screenshot BOTH orientations,
reason about device-vs-headless emoji metrics, and drive the neglect path.
**Fort Josh shipped with ONE level and a dialog that still ran off the right on a
real iPhone — two "done" claims that weren't.** Lessons, each now a rule: (1) **A
level-select that shows locked slots must actually HAVE levels behind them** —
the fort rendered 12 cards but only Level 1 existed in the data, so "beat L1 →
L2 unlocks" was impossible (L2 wasn't there). Fix: 5 real levels (distinct
paths/pads, a rising difficulty curve), progressive unlock (beat N ⭐ → N+1
opens), and a ▶ Next-level button on the victory screen. The guardrail is the
honest one a real-time game needs: a headless **auto-solver** (fill pads with
darts + upgrade greedily) must WIN every shipped level with a fair margin across
seeds AND doing nothing must LOSE — so a missing or unbeatable level fails the
suite loudly. (2) **A longer path makes a level EASIER, not harder** — more
coverage time = more tower DPS on each enemy; the first cut of L4/L5 (long paths)
was easier than L1, difficulty inverted. Tune the curve by SIM, not by eye:
shorten late paths + raise budget + cut gold until `autoPlay(Ln).lives` descends
L1→L5 (a `hard < easy` assertion pins it). (3) **A dialog clamp must never trust
`documentElement.clientWidth` or `vw`** — iOS Safari can report those wider than
the visible viewport (page overflow, URL bar, zoom), so a build menu that "fit"
in headless Chromium still spilled off the right on the real phone. The fix
positions and clamps ENTIRELY in the FIELD's own offset coordinates
(`wrap.clientWidth`/`offsetWidth`, capped to the field width) — engine-agnostic
real pixels that can't be fooled. And the meta-lesson the user had to repeat:
**WebKit isn't installed in the dev sandbox, so headless Chromium ≠ iOS Safari —
never say "fixed" for a device-specific bug on Chromium evidence alone.** Verify
by driving the deterministic engine headless (numbers), screenshot at the real
device size, reason explicitly about the iOS-vs-Chromium delta, and lean on CI's
WebKit `verify-live` + a real-device check for the final word.
**Fort Josh TD-3 added a 7-enemy roster + a boss, and the two lessons were about
CENTRALIZING and RE-BALANCING.** (1) **Every new on-death / on-hit ability must
route through ONE damage path, or it fires from some towers and not others** —
the engine had FIVE places that did `e.hp -= dmg; if (e.hp<=0) killEnemy()`
(dart, splash, chain, zap-beam, soldier-melee). A splitter/gold-burst/charge
bolted onto one of them would be invisible to the other four. Fix: one
`dealDamage(e, hpDmg, shieldDmg, how)` (charge-on-hit + death) and one idempotent
`killEnemy` (bounty + gold-burst + buffered split-spawn), and route all five
sites through them — so Mud Blob splits whether a dart, a mortar, or a soldier
lands the kill. Split-children are BUFFERED and flushed after the combat pass
(never mutate `state.enemies` mid-iteration). (2) **A new roster re-balances the
whole game — re-verify by SIM, and make the winnability oracle as smart as a real
player.** Armor (Plastic Knight halves Bonk) means a dart-only auto-solver now
*understates* winnability, so it would flag a fair level as unbeatable; the
PLAYABILITY test now tries BOTH a dart-swarm AND a Fan/Mortar mix and passes if
EITHER wins (a competent player picks the tool). A boss wave is deliberately far
off the ±25% budget curve → the wave-budget audit EXEMPTS `boss:true` waves (but
asserts they actually contain a boss). And a boss's HP must be tuned to ITS
level's pad geometry, not copied from the design doc: the plan's 3200-HP Bed
Monster barely died even to a maxed build on L4's 10-pad map, so it came down to
2400 (a wave-9 build kills it with a tense margin) — pin it with a "max build
kills the boss" + "every level winnable across seeds" sim. Lesson: adding content
to a tuned real-time game is a re-tuning job — the auto-solver sim is what keeps
it honest, and it has to be allowed to play smart.
**Fort Josh TD-4 finished the world — 4 more enemies, 2 more bosses, all 12
levels, 3 gimmicks — and the lessons were about UNTARGETABILITY, HP-GATED BOSSES,
and SCOPING HONESTLY.** (1) **An "untargetable" state must be enforced at EVERY
acquisition path, not just the shared one** — `candidates()` (mortar/fan/dart
re-pick) already excluded a hidden Glitter Ghost / tunnelling Mole via one
`isHidden(e)`, but the Dart's `first`-mode STICKY-keep branch didn't, so a dart
locked before the phase-out kept firing THROUGH it. A guardrail now drives a dart
at a lone ghost and asserts the lock DROPS while `phaseHidden` and re-acquires
when it shimmers back. When you add a "can't be hit right now" flag, grep every
place a target is chosen OR kept. (2) **A boss whose kit escalates by hp% needs a
dedicated `bossTick` + a test that FORCES each phase** — the tap-harness (and even
a full auto-solver) may never drop The Static below its 66%/33% thresholds, so the
disable/summon/dash code can ship dead-untested; the guardrail sets `boss.hp` to
each band and asserts a gun gets jammed, Battery Bots spawn, and `speedMult>1`.
The Vacuum King's soldier-suck is invisible to a tower-only solver (no soldiers to
eat) — so a camp-using guardrail proves the suck KOs a soldier. Drive the ability,
don't assume the win-sim exercised it. (3) **Scope a big content phase to what you
can SIM-verify, and label the cut loudly** — the plan's dual/merge/fork paths +
the L10 lever are a real multi-path subsystem; cramming them in beside 8 levels +
2 bosses risked the "green tests, broken game" trap, so TD-4 ships all 12 levels
as distinct RICH SINGLE paths + 3 fully-headless-testable gimmicks (night range,
conveyor speed-zone, mole tunnel) and DEFERS true multi-path/lever with an explicit
note (not a silent omission). (4) **A transient banner is per-SESSION UI, not
per-level — reset it on level start** — a boss klaxon shown on L8 bled over onto a
freshly-started L12 (its 2.6s auto-hide loses to a quick quit-restart); `startLevel`
now calls `UI.hideBanner()`, pinned by a browser test that shows a banner then
starts a different level and asserts it's cleared. This one was caught by a
SCREENSHOT, not a number test — for a real-time game, eyeball both orientations and
the level-to-level transitions, because stale-DOM/feel bugs live where the
tap/number harness can't see. And the authoring win: hand-writing ~100 waves to a
±25% budget curve is error-prone, so a scratch generator emitted the level literals
(programmatic pads that hug the whole lane for end-coverage) and a validator flagged
every out-of-band wave BEFORE the data file was touched.
**Fort Josh TD-5 added the between-runs META layer — and every lesson was about a
NEW SHAPE breaking an old assumption that had held for 12 hand-authored levels.**
(1) **A generated level isn't in `DATA.LEVELS` — so anything that looked a level
up by id crashes on it.** `UI.hud` did `DATA.LEVELS.find(l=>l.id===state.levelId)
.waves.length` for the next-wave preview; an Endless run's id is `"endless-
bedroom"` (a STRING, not in the campaign), so `level` was undefined and the HUD
threw `reading 'waves'` every frame — a page-error the tap-harness would have
missed because Endless is never entered by the campaign tests. Fix: the engine
flags `state.endless`, and the HUD (and anything else) treats a not-found level as
Endless (show `wave N ♾️`, skip the fixed-total preview). Lesson: when you add a
run that ISN'T a catalog entry, grep every `LEVELS.find(...levelId)` and give it an
endless branch. (2) **A test-only save reset must reset the FULL save shape.**
`__TD.resetSave()` rebuilt the old `{v,stars,settings,difficulty}` literal, so
after a reset `save.ach` was `undefined` and the first kill's `earnAch` crashed on
`save.ach.indexOf` — a regression the moment a new persisted field lands. Fix:
resetSave now writes every field (`meta/ach/endlessBest/midRun`) AND `earnAch`
coerces defensively; when you add a save field, update BOTH the loader defaults and
every reset path. (3) **Star-tree buffs are the honest test surface only because
they're PURE INPUT.** Every node applies at `createEngine(levelDef,{meta})` and
NOWHERE else, so a node-set metaMods is deterministic and a sim can prove "+40
gold / +2 lives / faster kill / cheaper branch" without a browser. Resist the urge
to sprinkle a buff at its use-site — one `metaMods(opts.meta)` computed once,
referenced everywhere. (4) **Endless is unbounded, so "it always ends" is true but
NOT cheaply sim-provable** — the `1.16^n` budget guarantees any fixed build is
eventually overwhelmed, but a maxed 14-pad build survives past 400k ticks (high
waves spawn thousands), so the test asserts the MEANINGFUL properties instead:
neglect loses fast (real stakes), a real build lasts many waves past neglect (real
depth), same seed → identical run (determinism). Don't write a test whose honest
form takes hours to run; assert the property, not the extreme. (5) **Resume is a
COLD STATE-SET, not a replay** — fast-forwarding the engine through the saved waves
with no towers just leaks all your lives; instead rebuild the towers (gold-bumped),
then set `waveIdx/gold/lives/phase` directly and let the engine schedule the right
next wave from `waveIdx`. Checkpoint granularity is the wave boundary (mid-wave
enemy positions are never saved — honest), the restore is marked `cheated:false`
(earned, not cheated), and `cur.lastBuildWave` is pre-set so the restore doesn't
immediately re-checkpoint itself.
**Fort Josh TD-6 (the polish pass) taught that "feel" polish is where the
untestable-by-tap bugs hide — so each juice feature shipped WITH the seam that
makes it verifiable.** (1) **A screen-shake must be OFF under
`prefers-reduced-motion`, and that has to be a real, tested gate — not a hopeful
CSS media query** — the shake lives in the canvas transform (JS), so the renderer
reads `matchMedia("(prefers-reduced-motion: reduce)")` ONCE at create and a
browser test drives it BOTH ways (`page.emulateMedia`) asserting the shake fires
when motion is allowed and NEVER when reduced. A juice effect a screenshot can't
freeze still gets a deterministic test via a `shakeInfo()` hook. (2) **An fx the
player can toggle needs the value THREADED, not just a flag** — damage numbers
read their amount off the `hit` event, so the engine now carries `dmg` (and
`tower`) on the event; the render metadata belongs on the event, computed once at
the damage site, so sfx (mortar-thump vs dart-tick) and the number fx both read it
without recomputing. (3) **Perf worry is often unfounded — MEASURE before
optimizing** — the fear was thousands of endless enemies dropping frames, but a
headless timing showed sub-millisecond ticks even on a maxed 14-tower board (a
competent build keeps the on-screen count low, and the frame loop already caps at
6 ticks/frame), so TD-6 added no speculative perf code. (4) **Looping music is the
setTimeout-composer precedent, mute-gated and OFF by default** — it schedules
gentle tones on a timer (never gating gameplay), stops on `stopLoop`, and re-checks
the mute + its own toggle every note so a mid-song mute silences it. Lesson: polish
is real work, and the discipline that made the tap-harness honest — a hook per
effect, the datum on the event, a measurement before a "fix" — is exactly what
keeps the FEEL layer honest too.
**Fort Josh's deep adversarial audit (12 dimensions, every finding independently
reproduced) surfaced 10 real defects the tap/number harness sailed past — each is
now guardrail-locked, and each generalized into a rule.** (1) **"Untargetable"
must be enforced at EVERY damage path, INCLUDING indirect ones** — a phased
Glitter Ghost / tunnelling Digger Mole was correctly excluded from every
*acquisition* path (candidates, dart sticky-keep, soldier-engage), but the mortar
**splash** detonation loop and the Static **chain-lightning** jump each re-scanned
`state.enemies` and skipped only fliers, so a shell landing near a hidden enemy —
or a chain arcing off a visible one — killed the enemy the design says you can't
touch (8 ghosts ship on L12's boss wave). The "grep every place a target is chosen
OR kept" lesson now explicitly extends to AoE and chain/beam jumps; all damage
paths route through one `isHidden(e)` gate, the engine exposes `isHidden` for tests,
and two node guardrails drive a mortar onto a hidden mole and a chain past a phased
ghost (both proven to FAIL on the pre-fix code). (2) **A save-field-coverage gap
crashes the first win on a legacy/corrupt save** — the boot defaults coerced
`difficulty/settings/meta/ach/endlessBest/midRun` but not `stars`, so a stored
`{v:1}` with no `stars` threw `undefined['1']` in phaseWatch on the first victory
(after `stopLoop()`, before `persist()`) — the win silently lost, the frame dead.
Exactly the class CLAUDE.md already documented for `save.ach`, still open for
`stars`; now coerced (`typeof save.stars !== "object" → {}`) with a browser
guardrail that wins on a stars-less save. **When you add a persisted field, patch
the loader defaults, resetSave, AND every reset path — all three.** (3) **Session-
only achievement context must ride the resume checkpoint, or a resumed win is
judged dishonestly** — `cur.leaked / soldiersLost / lines` live on the per-run
session object and were rebuilt fresh on resume, so a run that leaked lives before
quitting earned a FALSE "No Leaks", and a dart-only run that resumed could never
earn "Pea Purist" (`cur.lines` stayed `{}` because the resume rebuilds towers via
`engine.place()`, bypassing the UI handler that records the line). `writeMidRun`
now snapshots the achievement context and `resumeMidRun` restores it (and
repopulates `cur.lines` from the rebuilt towers). **A checkpoint must carry
everything the win-time judgement reads, not just towers/gold/lives.** (4) **A
meta-milestone recorded only on defeat is lost on a quit** — endless best-score +
"Marathoner" fired only in phaseWatch's `lost` branch, so quitting a high endless
run (or an unbeatable build that never dies) discarded it; a shared `leavingPlay()`
now records the milestone at BOTH leave chokepoints (the `td-home` route and
`onLeave`). (5) **Transient field state must be cleared when you leave the play
screen** — a half-armed camp Rally (`cur.rallyArmId`) survived navigation and ate
the first pad tap on return; `leavingPlay()` clears it (+ selection) too. (6) **A
per-outcome UI element needs its OWN teardown timer** — the achievement toast kept
a single shared `setTimeout` handle, so a win earning several badges at once
orphaned every toast but the last (a DOM leak); each toast now owns its removal
timer and cascades up the screen. (7) **A dialog that fits in portrait can still
clip in short landscape** — the pause menu (6 buttons) overflowed a 390-tall
landscape viewport with no scroll (title clipped above, quit button below); the
base `.td-overlay__box` now carries the same `max-height: calc(100dvh - 24px);
overflow-y: auto` the `--wide` victory/defeat variant already had. Meta-lesson: a
deterministic engine's *correctness* (a stat lever, an untargetable flag, a
checkpoint's fidelity) and a UI's *robustness* (a corrupt save, a landscape
dialog, a DOM leak) live exactly where a "does it win?" harness can't see — a
multi-dimension adversarial audit that drives the engine headless AND reasons about
save/resume/leave edges is what catches them.
**Fort Josh TD-7 (multi-path + the L10 lever) taught how to add a load-bearing
engine capability WITHOUT destabilizing a tuned game.** (1) **Make the new axis a
default-noop so every existing level is byte-identical** — lanes are
`paths=[levelDef.path]` and every enemy `pathIdx` defaults 0, so `epath(e)`/`epos(e)`
resolve to exactly the old single path; all 12 shipped levels keep their
determinism hashes and winnability with zero changes. The refactor is "grep every
`posAt(path, X.dist)` and route it through the enemy's OWN lane" — the same
discipline as the isHidden sweep, applied to positioning. (2) **A fork's two lanes
must SHARE an identical waypoint prefix so rerouting is seamless** — because
`posAt(short,d) === posAt(long,d)` for `d ≤ fork.at`, throwing the lever can
reassign `pathIdx` on every pre-fork enemy with NO teleport; it just diverges when
it reaches the split. The invariant is guardrail-tested (lanes coincide up to
`fork.at`, diverge after). (3) **Tune the new level so the EXISTING auto-solver
still proves it** — L10 is winnable on the hard DEFAULT (short) route by the
fill-and-upgrade solver (≥5 lives, 3 seeds) and losable by neglect, so it stays in
the "every level winnable" sim untouched; the lever is then proven SEPARATELY as a
real edge (a deliberately thin build LOSES on short but WINS once the lever routes
the train the long way — the same tail towers get far more exposure). Decoupling
"is it winnable" from "does the new mechanic help" keeps both honest. (4) **A
mechanic a number-sim can't feel needs a screenshot AND a real-tap browser test**
— the renderer had to draw a second ribbon and position each enemy on its lane
(`posOn(pathIdx,dist)`, not always lane 0) or long-lane enemies would render on the
wrong track; a headless screenshot caught that the lanes + lever button actually
paint, and a Playwright test taps the lever at its world position (via the shared
`w2s` map) and asserts the track switches. When a data field replaces a stub
(`pullLever: notYet` → real), grep every test that pinned the stub and re-point it.
**The APP-WIDE deep audit (11 dimensions, 42 agents, every finding independently
re-verified) confirmed 27 defects — and the headline lesson is the iOS-14.2
PLATFORM FLOOR: CI's modern browsers silently pass CSS/JS the real iPad DROPS.**
(1) **Safari 14.0 has no flex-gap, no `inset:` shorthand, no `dvh`** — the topbar
doors and ~20 game tap-rows collapsed to 0px (the ≥16px law silently void on
device), every fixed-position modal (grown-ups gate, buddy chooser, 华丽/fort
gates) fell below the fold as a shrink-wrapped box, and `min-height:100dvh` /
dialog clamps were dropped declarations. Fixes are LAWS now, guardrail-locked in
`site.test.js`: tappable spacing never relies on flex-gap (grid `gap` works on
14.0 — single-row stacks became `grid-auto-flow` grids; wrapping tile rows use
child margins; every remaining flex+gap rule sits on an explicit DECORATIVE
allowlist that any new rule must consciously join); `inset:` is banned repo-wide
(longhands only — including JS-injected cssText); every `dvh` declaration must be
immediately preceded by a same-property `vh` fallback (the old "never bare 100vh"
guardrail now enforces the PAIR instead). Corollary laws from the conversions: a
grid stage needs `grid-template-columns: minmax(0, 100%)` (a bare auto track
makes `width:100%` children collapse to content — add-up's 65px buttons — and a
rigid `100%` track lets a wide child blow the grid out); and `repeat(N, 1fr)` is
`minmax(auto,1fr)` — the Will-It-Fit lesson is now applied to EVERY grid in
main.css (`repeat(N, minmax(0,1fr))`), because an `aspect-ratio` cell's
transferred minimum can inflate tracks (story-order overflowed by exactly its
slot's min). (2) **route() only HIDES screens, so `isConnected` timer guards are
dead** — a navigated-away game kept narrating and advancing over the new screen.
Centralized: ALL framework speech/cues gate on `!screen.hidden` (`sayLive`),
`api.later()` gives games auto-cleared timers (cleared by `__onHide` on
navigation and on restart), and route() fires `__onHide` + one
`speechSynthesis.cancel()` per hash change. (3) **Confetti was one full-screen
canvas + rAF loop PER burst** — toddler hammer-taps piled 66 canvases (59→14fps);
now ONE shared canvas/loop/pool capped at 400 pieces (e2e hammer guardrail: ≤1
canvas after 40 bursts). (4) **The SW runtime-cached ANY response** — a captive
portal's 200-text/html sign-in page could poison a script entry and the offline
fallback preferred the poisoned exact match over the healthy precache (dead
shell); now only `res.ok` non-HTML (or navigation) responses are cached,
index.html falls back for NAVIGATIONS only, the PWA icons joined CORE — and the
offline test itself was dishonest: Playwright's `setOffline` does NOT gate SW
fetches (25 reached the server "offline"), so `startServer` grew `pause()/
resume()` (close + destroy sockets) for real hard-offline, plus a captive-portal
guardrail. (5) **Content truths**: a distractor that is ALSO defensible is the
recurring class — `makePairPick` now honors a per-item `avoid` list (Opposites'
big banned the small-looking 🐌; rain also opens sunflowers), category hunts
honor `excludeFillers` (✈️/🚁 are defensible "sky things"), Duck Pond gained
singular forms (`one/verbOne` — "one ducks swim" was spoken in 44% of rounds),
Little Detective's "green vehicle" 🚜 became yellow 🚕 (Apple renders the tractor
RED — emoji COLOR is vendor art, part of correctness like the dotless-i lesson),
🧯 is spoken as "the fire extinguisher", 华丽's festival set 2 swapped 春节 for
七夕节 (汤圆 IS a southern New-Year food — bins must never co-present festivals
sharing a custom), and 花 lists 把 in `alsoOk` (一把花 is standard). (6)
**Contrast is measurable, not eyeballable** — five AA failures (the shared
"Again" button at 2.46:1, category/sticker tile labels on light gradient ends,
华丽's dark-red-on-dark-red book label at 1.09:1, the grown-ups button) fixed
with verifier-verified colors/pills. (7) **Fort**: the thrown L10 lever now rides
the midRun checkpoint (restored on resume; `leverCd` deliberately NOT saved — an
absolute tick from the old run would wrongly lock a fresh engine); two fort tabs
no longer clobber each other (persist() folds MONOTONIC fields — stars/ach/
endlessBest max/union — while meta stays last-writer-wins because a respec
legitimately REMOVES nodes, and deliberate resets pass `{force:true}`); a junk
`#hl-*` hash no longer paints Josh's home red-gold (the unknown-hash fallback
clears the hash so hl-main's hashchange sync re-runs; belt: the theme only paints
for REAL hl screens). Meta-lesson: when the merge-on-persist fix landed, the
respec/reset tests went red — a "monotonic" merge is only correct for fields
that truly never decrease; enumerate which fields those ARE before merging.
**A pad-placement audit of all 15 fort maps found two pads sitting ON the path
(L5/L8 — enemies marched through the tower), five pairs in ADJACENT cells
(sockets touching, 0.9-radius tap zones contending), and four pads whose screen
position hid UNDER the floating CALL button** (an HTML button eats the tap, so
those pads were unbuildable — two on L4 in portrait, one each on endless-backyard
/L7). All eleven moved to clean cells (winnability re-simmed). Guardrails: a
td-logic geometry test (every pad ≥0.99 cells from every lane centre, pairwise
≥1.4, ≥1.9 from a lever) and a td browser test that walks all 15 maps × both
orientations asserting no pad centre falls under the CALL rect. Lesson: authored
coordinates need the same programmatic truth-check as authored waves — "the
solver wins" never notices a pad the PLAYER can't tap or a tower standing in
the road.
**A persisted field that changes SHAPE needs migration at BOOT and at the
two-tab MERGE, plus resetSave** — an old-version tab keeps writing the old
shape, so the merge must fold it too (the per-difficulty stars split folds a
legacy flat `{lvl:⭐}` map into the `normal` ladder at both sites). And when a
field splits into slices, decide EXPLICITLY which aggregates stay cross-slice:
the star tree / endless / star achievements read best-per-level across ladders
(ceiling unchanged at 36⭐), while the grid and unlocks are per-ladder — an
implicit "sum everything" would have tripled the meta economy.
**A meta shop must COST more than the currency ceiling, or it stops being a
choice** — the original 10-node tree cost 28⭐ vs 36 earnable, so a completionist
bought everything and had 8 dead stars (the user felt it: "to really utilize
stars well"); TD-8's 23-node tree costs 77⭐ and a guardrail asserts total>36
forever. Two implementation laws from the build: (1) **adding an rng draw where
none happened changes every historical replay** — Lucky Darts' crit roll fires
only when a chance EXISTS (`(s.crit||0)+bonus > 0`), so meta-less streams keep
their exact hashes (the determinism suite is the proof); (2) **gated purchases
need a CASCADE on refund** — dropping rank I must drop rank II and any capstone
whose in-branch spend fell below its requirement, or `save.meta` goes
inconsistent (owned-but-unearnable), locked by a browser test.
**A post-ship adversarial audit of TD-8 (6 dimensions, 12 agents driving the
engine headless, every finding independently reproduced) confirmed the feature
CORRECT — every ability fires once at the right site, balance holds (losable by
neglect on every level even fully maxed), determinism intact — and surfaced two
MINOR real defects the green suite missed, both now fixed + guarded.** (1) **A
new per-run flag must ride the resume checkpoint** — `state.shieldUsed` (🌟
Sticker Shield's one-free-leak) was absent from `writeMidRun`, so a resumed run
re-granted the free leak (one per segment, not per run); added to the checkpoint
+ restored in `resumeMidRun` (legacy midRun lacks it → false, matching a fresh
run) — the same checkpoint-fidelity class already documented for
leaked/soldiersLost/lines/leverRoute. (2) **An overlay rebuilt on every
interaction must preserve scrollTop** — the tree went 10→23 nodes (far taller
than its 86dvh box), and each buy/refund calls `metaOverlay` which removes +
re-appends the element, resetting scroll to 0; on a real phone a tap on a
bottom (Fortification) node jumped you back to the top every time (invisible at
the 390×844 test size — only a SHORT-viewport test catches it). Fix threads the
box's scrollTop through the re-render. Coverage the audit added (RULE 7): a
bossDmg-vs-SHIELDED-boss engine test (the Bed Monster's shield 0 left the
shield-multiply line unexercised — a mutation would've stayed green), a
neglect-with-FULL-tree guardrail on every level (a future survival-inflating
ability can't ship green), and short-viewport tree reachability + scroll-stability
browser tests. One finding left AS-DESIGNED: the two-tab `persist` meta
last-writer-wins (a concurrent purchase in a second fort tab is lost) — unioning
meta would resurrect refunded nodes as free power, and it's self-recoverable
(earned ⭐ are preserved by the monotonic merge, respec is free). Lesson: "green
+ committed" ≠ "correct"; a deterministic engine earns a headless adversarial
audit that drives every lever and reasons about resume/scroll/merge edges the
tap-harness can't see.
**A PLAYABILITY/DIFFICULTY audit (headless sims of every level × difficulty ×
build) found the authored ramp was INVERTED in play, and taught that this engine
is THRESHOLD-dominated.** Measured on the shipped build: **76% of all damage
landed in waves 1-3** (116 lives vs 37 across every later wave), 9/12 levels
finished flawless despite late waves being 5-10× bigger on paper (L12 ramps
8→95 budget), and **patient play lost 6/12 levels** — the early-call bonus
(135g ≈ 2 extra opening towers) wasn't a greed option, it was mandatory. Root
cause: the opening build, decided by startGold, faces the same wave-1 threat
regardless of skill, then upgrade DPS outscales the wave curve forever after.
Two things were fixed: (1) **the four wave-1 GOTCHA levels** (L3/L6/L7/L9 lost
4-11 lives before a real board could exist) got startGold raised (330→400,
320→380, 380→450, 440→520) — front-loading dropped 76%→53% and those levels
became fair; (2) **the Vacuum King (L8) had NO tower-facing threat** — its whole
kit (`suck` = inhale a SOLDIER) was invisible to a tower-only board, so the
World-2 finale cost ZERO lives (19/20, easier than L3). It now also jams a gun
under half hp, reusing the Static's already-tested `phases`/`disable` path (no
new engine code), + hp 5200→8000: L8 is now a real fight (19.0→15.3 lives). The
NEGATIVE result is just as important and is why no global re-tune shipped: a
maxed board either holds a wave completely or collapses, so scaling late waves
produces NO chip damage — it flips a level straight from flawless to a loss
(L4 died at late×1.8). A parametric sweep (start-gold × bounty × curve-base ×
growth-exponent, ~40 configurations) never converged on a descending curve;
raising gold alone just trivializes everything (avg 19.6/20). Lesson: in a
threshold-dominated TD, difficulty must come from THREAT SHAPE (fast fliers /
untargetable / disruption that partially bypasses a build) rather than bigger
HP piles — and the honest deliverable was the two verified fixes plus
guardrails, not a sweeping re-balance the data didn't support. Guardrails:
`td-logic.test.js` now fails if any level loses >5 lives in waves 1-3 (the
gotcha class) or if a boss finale lets a sensible build finish above 17/20 (the
formality class); the Bed Monster is explicitly exempted from the tower-facing
rule because it earns its finale as a raw DPS check, which the sim proves.
**The follow-up pass acted on that audit's own prediction — and proved THREAT
SHAPE is the knob HP never was.** The audit said difficulty must come from what
a build has to COUNTER, not from bigger HP piles; measuring the roster showed
**all four World-3 levels shipped with ZERO fliers in any wave** (6 of the 8
World-2/3 levels had none at all — L7 was carrying the entire air game). Only
dart and fan can hit air, so a mortar-only board flew through the endgame
untouched: mortar solo-carried **8/12** levels. Fix: 40 late waves across the backyard + toy-store worlds now
convert **20% of their HP into Kite Hawk flights** (30% on L11), **preserving
total wave HP** so the ±25% budget contract is untouched — World 1 stays the
flier-free tutorial. Result: mortar-mono **8/12 → 1/12**, front-loading
**76% → 54%**, every level still winnable and still losable by neglect. The
method generalizes: **an HP-preserving threat SWAP is the safe way to re-tune a
budget-contracted wave table** — it changes what the wave demands without
touching the number the audit checks. Heroic was the other real fix: it was
winnable on only **6/12** levels, and the toxic knob was **`speed`, not `hp`** —
a 1.08 speed multiplier compounds with conveyor zones and already-fast fliers and
steals tower UPTIME, which gold cannot buy back, while a NEGATIVE start-gold on
top made the opening unrecoverable. Re-shaped to a pure hp/economy challenge
(`hp 1.30, speed 1.0, bounty 0.9, startGold +40`) → **12/12 winnable** and still
clearly harder than normal. Two items were closed WITHOUT a change, which is the
honest outcome: **L11 cannot be made to end harder than L10 inside the budget
contract** — pushing its late waves to the very top of the band produced
literally zero movement (`late x1.2 | wins 3/3 | lives 17.3 (need < 15.0) |
late-dmg 0.0 | band true`), the same threshold ceiling the first audit found; and
**tier-4 branches are a STRATEGY axis, not gated content** — a TALL build (cap
~5 towers, pour everything into upgrades + branches) reaches tier-4 by wave 7-11
on six levels, while cutting branch costs to 0.7× still leaves the WIDE
fill-every-pad build at only 2/12, so the branch isn't priced out, breadth is
simply a different (valid) choice. Guardrails: `AUDIT threat shape` fails if a
World-2/3 late wave loses its air pressure or if World 1 grows hawks, and
`AUDIT heroic is a SLOPE` pins `speed === 1.0`, `startGold >= 0`,
`hp > 1.2 && bounty < 1`, and every level winnable on heroic.
**The fort's ⚙️ reset had to become the THIRD instance of the same law, so it
shipped as a single owner from the start** — CLAUDE.md already documents two
save-field-coverage crashes (`save.ach`, then `save.stars`) caused by a reset
path that missed a newly-persisted field and left it `undefined`. Rather than
add a second literal beside `__TD.resetSave`'s, the wipe is now ONE
`freshSave()`/`resetProgress()` in `td-main.js` that the grown-ups button and
the test hook both call, guardrail-locked by a `site.test.js` check that (a) the
hook is literally `resetSave: () => resetProgress()`, (b) the reset passes
`{force:true}` (without it `persist`'s monotonic merge folds the wiped
stars/badges/endless-bests straight back in and the reset is a silent no-op),
and (c) `freshSave()` mentions every field the boot loader coerces. Two smaller
generalizations came with it: **a toast must mount on the screen that is
actually VISIBLE** (`UI.toast` hard-coded `#screen-td-play`, so a fort-home
toast would have been invisible — now one `UI.notice` picks the unhidden screen
and the badge toast delegates to it); and the testing footgun that cost the
first red run — **`page.goto(url + "#hash")` is a SAME-DOCUMENT navigation**, so
a test that seeds `localStorage` and then "reloads" via a hash URL never
re-runs module init and silently asserts against the OLD in-memory state (it
looked like the seed was ignored). Seed → `page.reload()` → hop the hash.
**The level-expansion programme (PLAN_EXPANSION.md phases 1-4) produced four
measurements that overturn things this file previously asserted, and each one is
worth more than the feature it shipped with.** (1) **An enemy's ID was
load-bearing on the tick stream.** The spawn queue tiebreaks same-tick spawns
alphabetically by type id, so RENAMING an enemy re-orders spawns: cloning the
four backbone types under new ids left every one of 384 runs' phase/lives/gold/
kills identical but moved `tick` on 22. An id is a name; the ORDER is the
behaviour — the tiebreak now runs through a stable `sortKey` a skin inherits
from its ancestor, as a default-noop. Making the tiebreak id-INDEPENDENT instead
(relying on Array.sort's stability) was measured and rejected: it moves 4 of 576
outcomes. That let ten per-world backbone SKINS ship for free, which was the
single biggest differentiation available anywhere — the four ground backbone
types were 84-88% of every body worlds 4-6 spawn, and the Garage and Moving Day
scored a cosine similarity of **0.997** on their body-count vectors (worst pair
is 0.691 now). The two duplicated `BACKBONE` literals (the generator's and the
test's) were the mechanical cause and now derive from `WORLDS[w].backbone`.
(2) **HP-preservation is not balance-preservation.** The plan asserted an
HP-preserving special swap was free; permuting the attic's specials at constant
wave HP took L13 and L14 to LOST on every heroic seed. Worse, one move is a
cliff across a whole world: putting the Digger Mole on wave 11 instead of 12
loses heroic outright on L13 and L14 and takes L16's finale from 7 lives to 3.
Measure every candidate; ship only the subset that measures flat. (3) **Lives
REMAINING is the wrong metric the moment the meta can change the starting
total.** `AUDIT boss tension` judges a 5-17 band out of 20, but Extra Hearts
starts you at 24 — so a lives-boosting loadout scores as "softer" for free.
Re-measured in lives LOST, the full star tree is far less catastrophic than
"all six finales erased", and the real culprit is not loadout SIZE at all:
blaming all 23 nodes individually, **three single nodes each take L16 from 10
lives lost to 0** (Sharp Darts, Sharp Darts II, Boss Bonker) and Sticker Shield
takes L24 from 7 to 1, while all seven Economy nodes and six of eight
Fortification nodes are worth ≤2 lives. L8 and L16 are the boss-QUANTIZED levels
(L16's waves 1-14 leak nothing on any seed), so one boss leak is worth 8 lives
and any damage increase flips them from one leak to none. A per-run slot cap
(`RULES.metaSlots`, `save.loadout`) still ships and is real — it stops "own
everything, bring everything" — but it is recorded that it does NOT de-quantize
those two finales. (4) **Gold had stopped being a cost for the powers**: a
fully-built board holds 0-145 gold through wave 10 and then 351 → 1115 → 2375 →
3533 → **5393** on L24, i.e. 67 free uses of the cheapest power on the last wave.
A per-KILL grant provably cannot fix it (supply scales with wave size, 1.18^n;
cooldown-limited demand scales only with wave duration), so ⚙️ Toy Energy is a
flat per-wave budget — and the flatness assertion is what a per-kill version
fails. It took ability-spam on L16 from a flawless 20/20 to 8 and on L20 from
20/20 to 9. Two smaller laws from the same programme: **a scan's file list, a
guardrail's viewport list and a metric's denominator are all part of the test** —
the ability-abuse and ALL_META instruments only existed because Phase 1 built
them, and both immediately found real erosion nothing else could see; and **a
guardrail that only inspects the artefact misses the live path** — the loadout
test passed while `startLevel` still handed a run everything owned, because it
only read the checkpoint, so the engine now records its own `state.meta`.

**EVERY TIER-4 BRANCH WAS UNVERIFIED, AND THE THREE FIXTURE BUGS FOUND WHILE
FIXING IT ARE WORTH MORE THAN THE TESTS.** Asked for a brainstorm on a third
ultimate per tower, the first thing to measure was what the existing eight
prove — and the answer was nothing about their MECHANICS. Both winnability
oracles fill and upgrade with `t.tier < 3`, so neither ever calls `branch()`;
what existed was exclusivity, pricing, a no-DPS-downgrade stat table and a
pixel-hash silhouette check. That is precisely how Sticky Bomb shipped for
months whose *"the goo it LEAVES slows whatever WALKS IN"* existed only as a
sentence. Six branches now prove their own claim through their own seam (Dino's
`blocks: 2` and RC's `stun` were already driven, and a near-duplicate is noise,
not coverage), each mutation-proven: Sniper by **first-shot DISTANCE**, because
shot COUNT is confounded by rate (2.2s vs 0.7s) while distance is pure range;
Minigun by the damage stream reading `3,4,5,6,7,8,9,9,3,4,…` — ramp to full,
then back to the floor on a real retarget; Bertha by bodies caught by the FIRST
shell; Sticky by a body **newly slowed on a tick with NO detonation** (on a
mortar-only board nothing else can slow anything, so that IS "walks in", and it
needs no position at all); Blizzard by marking brittle where T3 and Static do
not; Static by an arc reading `30, 23, 17, 13`. **Three fixture bugs were hit,
each of which first presented as a product defect** — the "suspect the FIXTURE"
law three times in one sitting: `state.enemies` is COMPACTED on death, so a
before/after hp diff cannot see a kill and a one-shotting shell scored "0 bodies
hit" (count `die` events plus surviving hp drops); an enemy carries `dist` along
its lane, **not `x`/`y`**, so a probe reading x/y reads undefined, every body
scores as outside the puddle, and the goo claim fails on a working engine; and a
blast-width count **against socks measures nothing**, because a tier-3 shell
already one-shots every sock in its radius and both blasts saturate (Crate 9,
Bertha 9, Sticky 11 — not even ordered by radius), so it must use a body that
SURVIVES the hit and becomes pure geometry (8 → 11). One more general lesson,
from test 6: **two clauses can be needed because they catch different
mutations** — the per-link decay check pins the arc's SHAPE (applying decay once
gives `30,23,23,23` and fails it) but goes vacuous at `decay: 1.0`, where the
expectation flattens with the data, so a separate "the arc genuinely weakens"
clause carries that case. On the design question itself, `PLAN_TOWER_BRANCHES.md`
records the answer: a third ultimate is right for **Dart** and **Fan** and wrong
for Mortar and Camp, whose every candidate duplicates a shipped ability or gives
a line air access and goes red on the two-lines-reach-air truth table — *"each
line has as many ultimates as it has real axes"* is a design statement; *"every
line has three"* would require inventing two. **And the document's own §6 was
then refuted by measuring it within the hour**, which is the discipline working
on itself: it reasoned that a third branch button "simply wraps, so layout is not
a blocker", and driving the real tier-3 panel with a cloned card shows the third
takes a whole third row (+111px, 239 → 350) and goes past the fold on **320×480,
320×568 AND landscape 844×390** (12/20/33px). A third branch needs a panel
re-fit, not two template lines. That probe hit the fixture class one more time
for luck: **the tower panel now STAYS OPEN and re-renders after a purchase**, so
clicking `.td-up` three times lands the third click on a branch card and
silently measures a tier-4 panel with no branch row — drive upgrades through
`__TD.script` and click only to open.

**THE CAMP'S RALLY WAS DEFERRED AS COSMETIC AND WAS NOT — and the reason it read
as cosmetic is that the guardrail meant to catch it walked ONE level while its
own comment said "EVERY camp-able pad".** This file carried `defaultRally`'s
half-cell bias as known-and-not-worth-fixing, on the grounds that removing it
"moves 237 of 247 pads' rally points … and takes soldier posts >0.5 cells off a
lane from 1 to 4". Swept properly — all 40 levels, every pad, against EVERY lane
— the shipped numbers were **22 of 501 pads posting a soldier off the lane** and
**16 of 501 camps opening on a flag `rally()` itself refuses**. Three defects,
one per layer, and each fix is a different shape. (1) **A spread along a straight
TANGENT leaves the polyline** — at a lane END it simply runs off the last
waypoint (L18/p2 rallies at the exit (23,0) and posted a guy at (23.52,−0.10),
i.e. off the board on a 24-wide grid). **I first wrote this up as "a dead
soldier" and MEASURED it before committing, which is the reason this paragraph is
smaller than it started:** the engage radius is 0.55 and that post is 0.53 out,
so it is *not* inert — it blocks 8 bodies where its two siblings block 17 and 18.
The real defect is that it stands past the end of the road, is out of position,
and is one stagger-width from useless. Posts now walk the lane's own ARC LENGTH
with the squad's window slid inside the lane, so "on the road" is true by
construction for every lane shape and no future spacing can tip it past 0.55; a
rally point the player placed OFF the lane keeps its offset, so only the SPREAD
changed. 22 → 0, worst 0.224. **Check a claim like "it can never work" against
the number that decides it** — 0.53 against 0.55 is the whole difference between
a positioning bug and a dead feature, and the overstatement was already written
into the code comment and the assertion message before the probe caught it. (2) **The bias itself is the fifth site to mix this engine's two
coordinate spaces** — a lane point is a CELL INDEX and `pad.cx + 0.5` is a WORLD
centre, and only one side got the +0.5. (3) **The gate and the engine disagreed
about reach, and the GATE was the wrong one.** `rallyRange` said 2.5 while
`defaultRally` has always posted soldiers up to 3.04 out — so the tuned reality
was ~3.0 and the rule refused the player the reach the engine was already using.
Pad-to-nearest-lane distance across all 501 pads is p90 2.00, max 3.000, so
**3.05 is the measured smallest value under which every camp-able pad can put its
wall on the road**; `rally()` and `defaultRally` now share ONE predicate.
**The first fix I reached for was a REGRESSION, and measuring the engage radius
is what caught it**: clamping the default into the old 2.5 gate fixed
reachability (16 → 0) but, on the 9 pads that sit 3.00 from every lane, left the
flag 0.50 short of the road — and since the ±0.10 stagger is perpendicular too,
half of each of those squads lands at 0.60, **past the 0.55 engage radius and so
genuinely unable to reach anything on the lane**. A reachability fix that
silently disarms part of seven squads is worse than the bug it fixes. **And two of my own instruments lied on the
way**: a hand-rolled camp board showed L28 flipping won → lost, which is the
recorded "a pad ORDERING is part of the oracle" trap (the shipped `PLANS=camp`
arm is byte-identical on all 9 affected levels × 8 seeds × both difficulties);
and a `grep -E "^L[0-9]"` over the sim's output silently dropped **L4**, because
ids are padded to two chars and it prints `L 4` — a scan's own PATTERN is part of
the scan. Two empty result files also compared "IDENTICAL" before either job had
finished, which is the degenerate reading in its purest form: assert the files
are non-empty before believing a diff. **Testing lesson, the sharpest one:
mutation M1 PASSED.** With the reach widened, the biased default is still inside
the gate and still on a lane, so restoring the bias survived both of the clauses
I had written — the widening alone satisfied them. A third clause was needed that
asks for what the fix actually claims: the default must be the NEAREST lane point
*in the engine's own space* (biased, it is up to 1.062 cells further than the true
minimum on 16 pads; unbiased, 0.000 on all 501). When a mutation passes, the test
is measuring something adjacent to the claim. The clamp survives as the thing that
makes `defaultRally`'s postcondition unconditional rather than a silent
precondition on level data — proven by a marooned-pad fixture, and proven DEAD on
shipped data by the clause that every pad reaches the road, which is what makes a
future distant pad fail with an actionable message instead of an illegal state.
**Do not `git stash` uncommitted work inside a command that can time out** — a
2-minute cap killed the wrapper before its `stash pop` and left the whole change
in `stash@{0}` with a clean-looking tree. Use a `git worktree` at the baseline
commit instead; it also lets before/after run in parallel.

**"ASK THE ENGINE, NEVER RE-DERIVE" HAD TWO MORE VIOLATIONS, and both were on
the money moving the OTHER way — which is why nobody reported them.** The price
flash fixed the panel showing 110 while 🔧 Handyman charged 99; the SELL refund
one line above it in the same function was still
`Math.floor(t.spent * DATA.RULES.sellRefund)` — the raw rule — while `sell()`
pays `× mods.sellRefund`. ♻️ Trade-In lifts that 80% → 90%, so a run owning it
was shown **272** on a tier-3 dart and handed **306**. The out-of-energy hint had
the identical shape: it printed `RULES.chargePerWave`, so a 🔋 Spare Battery run
was told it banks 2 ⚙️ a wave while banking 3. **UNDERSTATING what the player
gets is the quiet half of this class** — an overcharge produces a bug report and
a greyed-out button you can afford, while being handed MORE than the label
promised produces nothing at all, so only a test finds it. Both now have an
engine owner (`refundOf`, `chargeGrant`) that `sell()` and the wave payout use
themselves, plus a structural scan that `td-main` reads neither rule (with the
Toybox Guide deliberately exempt — it explains the MECHANIC, so quoting the base
rule there is correct, and that distinction is what keeps the scan from being a
false-positive machine). **The fixture lesson landed twice in one test.** The
browser probe upgraded with `__TD.script([["upgrade", id], …])` — the op takes an
INDEX into `state.towers`, not an id — so both upgrades silently no-opped and the
probe measured a tier-1 tower while its comment claimed tier 3; the mutation
still went red (56 vs 63), so it would have shipped as a passing test of the
wrong thing. It now returns `tier`/`spent` and asserts them, and reproduces the
real numbers (272 vs 306). And **a one-owner scan that counts an IDENTIFIER
catches every name containing it**: the first rally-reach scan matched
`rallyRange` and scored the gate's own name `rallyRangeOK` three times, reporting
5 owners of a value with 2 — count the DATA path (`TOWERS.camp.rallyRange`), not
the word.

**THE TOWER PANEL'S STAT LINE WAS THE THIRD AND WORST INSTANCE, and unlike the
other two it was wrong with NO META AT ALL.** `statLine` read raw `DATA` for
every figure it prints, so on a NIGHT level it said **"3 rng" while the engine
used 2.55 — and the range RING drawn beside it in the same panel already showed
2.55**, because the ring was fixed to ask the engine and the TEXT was never in
that list. On a ⚡ power pad it understated the other way (3 against 3.54),
hiding the entire benefit of the socket — the one thing the `% road` figure had
just been shipped to make visible. With nodes owned it was also wrong on five
more axes: dart dps 34 vs 41 (🎯 Sharp Darts II), mortar splash 1.6 vs 1.92
(💥 Big Booms II), fan aura 2.4 vs 2.70 (❄️ Cold Front), soldier hp 120 vs 156
(🪖 Tough Troops II), and no crit shown at all on a 🍀 Lucky Darts run. Fixed with
`towerStats(towerId)`: range comes from `towerReach`, the existing ONE owner, and
the rest apply exactly the mods the combat sites apply, **keyed on `def.kind`
like the combat branches themselves** so a fifth line of a known kind inherits
them. Three things worth keeping. (1) **It is deliberately a SECOND
multiplication of `mods`, and is therefore pinned BEHAVIOURALLY rather than
structurally** — the panel's dps must equal the damage a shot really carries,
driven through the real firing path and read off the projectile, and the soldier
hp must equal what a soldier actually spawns with; routing ten hot-loop sites
through a new accessor to get structural one-ownership is a refactor of a tuned
deterministic engine, and a failing number is the cheaper guarantee. (2) **The
moment a UI reads engine values it inherits FLOATS**: `2.4 + 0.3` is
`2.7000000000000002` and a night range is `2.5499999…`, so the line needs a
formatter — the mutation that removes it renders `❄️ 50% slow ·
2.6999999999999997 aura`, which would have been a worse bug than the stale number
it replaced, and only reading the DOM catches it. (3) **Every "it reflects the
engine" clause needs a partner clause that the value actually MOVES**, or it is
satisfied by the raw number — each of the five was mutation-proven separately by
neutering just its own multiplier. (4) **A new accessor that multiplies a data
field inherits the field-one-short law** — `undefined * 1.2` is NaN and this one
is PRINTED, so the failure mode is a panel reading "NaN dps", the same class as
the `mult`-less zone that froze every enemy and the `delay`-less wave group that
hung a level. Every multiplied field is coerced, and a DERIVED guardrail walks
every tier and branch of every line (22 blocks) so an author hears about a
missing stat at authoring time rather than the player hearing about it on the
panel. And the mutation for that clause **silently did not mutate the first
time** — I searched `td-data.js` for `bertha`, but branches are keyed `a`/`b`/`c`,
so the script threw, the test printed `ok`, and it looked like a proven clause.
Check that the file actually changed before believing a mutation result; this is
the em-dash trap's third appearance in this repo.

**ENUMERATING THE ENGINE'S EXPORTS FOUND THE ONE NOTHING DROVE — `isRevealed`,
which exists for the RENDERER alone — and isolating its test took FOUR attempts,
every one of which passed while measuring the wrong thing.** The export's whole
job is the pulsing amber halo on a body flushed out by 🧨, which is the player's
only confirmation that a 130-gold blast reached something it cannot normally
touch; the ENGINE side was covered (the P3 tests prove a revealed hider becomes
targetable through the one `isHidden` gate) and the PICTURE was not, so the halo
could have stopped painting with the suite green. It does paint — a coverage
hole, not a defect — but the four failed isolations are the lesson. (1) The
obvious probe (hidden body → draw → reveal → draw) measures the SPRITE becoming
un-hidden, because `isHidden` returns false the moment `revealedAt` is true; the
halo mutation passed. (2) Latching the two bodies across ticks let the visible
one walk into the tunnel before the draw, so the control's own precondition was
false. (3) `draw()` AGES every screen fx by one, so two consecutive draws are
not the same picture — fixed by ageing the board empty and asserting a residue
of ~0, which makes the isolation self-verifying rather than assumed. (4) The
one that actually mattered: a blast-sized reveal covers the NEIGHBOURS, and a
nearby hidden mole appearing inside the sample box is worth **212 px on its own**
— more than the threshold I had picked, which is exactly why the mutation kept
passing. **Stop guessing and print what changed**: a diagnostic reporting the
changed-pixel bbox and mean RGB delta showed 919 px of warm brightening with the
halo and 212 px of *darkening at the bottom of the box* without it, which named
the confound immediately. The fix is a reveal radius tight enough to contain
only the sampled body, with `solo === 1` asserted rather than hoped — after
which the mutation reads **0 px of 2704**. General rule, now paid for twice in
two days: **when a mutation passes, do not raise the threshold — find out what
else moved.** And a scan's own pattern is part of the scan for the third time:
my export enumerator matched comment prose and reported 59 "untested exports",
and after stripping comments it reported `rangeMul` too, which is a false
positive from an access-pattern regex that missed `engine.rangeMul || 1`.
**The same pass closed the mirror hole in the badge audit**: it checked that
every boss finale awards a badge and that every awarded id is declared, but never
that every DECLARED badge is awarded — so a twentieth achievement could ship
counted by the `bosses + 9` structure test, rendered in the 🏅 overlay, and
handed out by nothing. Measured clean (all 19 are awarded), so it exists for the
next one — the same dead-content class as heroic shipping with no selector and
World 4 shipping with no cards.
**The same enumeration applied to the RENDERER found four undriven hooks, and
the one that mattered was `setDamageNumbers`** — an opt-in fx wired end to end
(pause toggle → save → renderer) whose own comment in td-main calls it a hook
"for tests", with no test driving it. That is exactly the shape in which the
Fan's beam and the muzzle flash each turned out to draw nothing at all. It
works; the gap was coverage. Two things worth keeping. **A number is TEXT, so
wrap `fillText` and read it** rather than diffing pixels — the lever-countdown
lesson — which lets the test assert the TD-6 threading claim directly (the
value must come from the event, not be recomputed) instead of settling for
"something changed". And **a mutation that fires an EARLIER clause has not
proven the later one**: hard-coding the text to `"9"` failed the "ON draws 37"
clause, so the threading clause was still unproven until a second mutation
hard-coded it to `"37"` — clause 2 then passes and only clause 3 goes red.
Removed while there: `text: (e.crit ? "" : "") + e.dmg`, a ternary with two
empty branches that reads like a crit prefix and is a no-op. Left alone and
recorded instead: `cellSize` is a genuinely dead export (no app or test
reference), but a one-line accessor is neither misleading nor unfalsifiable, so
it does not meet the bar that retired Kid Fort and the bed-glyph clamp.
**And enumerating the 18 `__TD` hooks closed the loop on the badge work itself:
`ach` was undriven, and the reason turned out to matter.** The guardrail added
an hour earlier — every declared badge must be awarded — is a TEXT scan of
td-main.js: it proves an `earnAch("doorman")` line EXISTS, never that beating a
level runs it. Every other badge test SEEDS `save.ach` to exercise the
merge/reset/persist paths, so **nothing had ever driven the award chain**, which
is precisely the path this file records crashing twice (`save.ach.indexOf` on a
legacy save, then `save.stars`). A win that silently earned nothing would have
looked exactly like a win. The new test resets the save, wins L1 honestly, and
asserts both a level-id badge and an event badge — two clauses because they are
wired in different places, which three mutations confirm: kill the level-id
branch and only First Blood survives; kill the event branch and only Doorman
does; make `earnAch` a no-op and both vanish. **The general shape, now seen
three times in one session: a structural scan proves a CALL SITE exists, and only
driving the feature proves the call does anything** — pair them rather than
picking one. The third instance was the **Toybox Guide**, which builds six
sections from data and had only two asserted on the RENDERED page (enemy cards,
star tree). Every `levelGimmicks` test lives in `td-logic.test.js` and checks the
DERIVATION, so the render loop could drop the Level-tricks section — or the
Powers row, or the branch roles, or the tower lines — and every one of those
guardrails would stay green while the mechanic went undocumented, which is the
exact condition the guide was written to fix. One browser test now walks all
four against the data (a sixth gimmick, a fifth line, a ninth branch or a sixth
power inherits it), with an explicit non-empty check on each list so the loops
cannot pass vacuously; mutation-proven by emptying the gimmick loop and the
powers row separately.

**TD-18 shipped four between-runs features — 🎖️ challenge chips, 📅 the Daily
Toybox, per-world endless mini-bosses and 🎇 the Sparkler — and every lesson in
it was about a claim that LOOKED verified and was not.** (1) **A constraint is
the one kind of new content that cannot inflate a tuned curve, which is what
makes chips safe** — a chip only ever REMOVES an option (a tower line, or the
powers), so `chips: []` is a default-noop proven byte-identical on the
determinism hash, no winnability sim moved, and the whole feature needed no
re-tune. Both bans are enforced in the ENGINE (the first clause of `place()` and
of `abilityReady()`), never in the UI, so the menu greying out is a courtesy and
the rule is the engine's. (2) **A challenge nobody can complete is worse than no
challenge, so completability was MEASURED before shipping, and it cut a chip.**
A fifth chip banning the Dart looked like the obvious mirror of the other three
and fails **30 of 40 levels on normal** (10 of 40 even on casual), because the
Dart is the documented generalist and two of the remaining lines cannot reach
air. It was cut and the measurement is written into the data file beside the
list, so the next author does not re-add it. The other four clear all 40. (3)
**A law can be arithmetically impossible, and writing it down is how you find
out** — the first mini-boss rule was "each world's spike must be beefier than
anything in its own pool", and there are only four bodies above 150hp against
ten worlds competing for them, so it could never be satisfied. Replaced with
"≥ the pool's median hp", which three of my ten assignments then FAILED (ghost
0.61×, healer 0.94×, racer 1.00×) — the law earning its keep on the very batch
that wrote it. (4) **I claimed a two-clause guardrail was load-bearing on both
halves and it was not**, so the comment now says which half is vacuous: the
"a mini-boss must carry a KIT" clause cannot fail on shipped data, because every
kit-less body caps at 34hp and the lowest pool median is 40, so the hp clause
already excludes them. Say that in the comment rather than implying two
protections where there is one.

**THE SPARKLER'S THIRD CLAUSE PASSED ITS MUTATION FOUR TIMES, AND ONLY THE
FOURTH DIAGNOSIS WAS THE REAL ONE — because the fixture was one field short.**
🎇 Sparkler is the Loose Screw's mirror (the Screw jams on a TIMER; this one jams
where you let it DIE), so its test has to rule out an aura, and the clause "a
LIVING sparkler jams nothing" survived an aura mutation four times running: (a)
the body was parked at dist 0, far from the tower, so the mutation could not
reach it; (b) the assertion read `disabledUntil > tick` at the END, but
`jamNearest` skips an already-jammed tower so the jam had expired by then — it
asserts `=== 0` now, which catches a jam that has since lapsed; (c) `tick()`
returns early in the BUILD phase, so a fixture that never calls a wave runs none
of the per-tick enemy code at all; and (d) the one that actually mattered — the
hand-built enemy literal omitted **`speed`**, `effSpeed` returns `e.speed`, so
`dist` went **NaN**, `posAt` clamps NaN to the LANE END, and the body silently
teleported 18 cells away from the tower every tick. The post-loop read looked
perfect because the loop PINS `dist` back after each tick, so the corruption
existed only inside the code under test. Three things generalise. **Print what
happened INSIDE the loop, not what the state looks like afterwards** — one
`console.log` in the mutated branch showed `dist NaN` immediately, after three
wrong theories reasoned from end-state alone. **A hand-built body needs every
field the hot loop multiplies** — this is the `mult`-less zone and the
`delay`-less wave group for the fourth time, now inside a TEST, and the fixture
is the one place the engine's own coercions cannot protect you. And **a fixture
precondition should be self-verifying**: the clause now ticks once WITHOUT
pinning and asserts the body actually walked a finite, sane step, which fails
loudly (`step NaN`) the moment a field goes missing again, instead of passing
vacuously. Both halves mutation-proven — the aura mutation now reads
`expected 0, actual 241`, and deleting `speed` from the fixture fires the new
precondition rather than the claim.

**AND THE DOSE MEASUREMENT REPRODUCED THE SAME CLASS ONE LEVEL UP: a probe that
calls an API the engine does not have returns a confident ZERO.** The Sparkler's
campaign dose measured byte-identical to its control on all 8 seeds × both
difficulties, which is the correct answer and is ALSO exactly what a dose that
never fires looks like — so it was verified rather than believed. The first
verification probe drained events with `e.drain ? e.drain() : []`; the engine
exposes `e.events`, not `drain()`, so the ternary quietly evaluated to `[]` and
it reported **"5 sparklers spawned, 0 deaths, 0 jams"** on a fully working
mechanic. Read against the real buffer it reports 5 spawned, 5 dead and **3
jams**, i.e. the mechanic is live in a real campaign run and is simply absorbed
by a maxed board — the Oil Drum's result and the Oil Drum's reason (the shipped
oracle has no positional agency, so it can never choose where to break one). An
outcome-neutral body cannot break a tuned level, which is what makes it safe to
ship for legibility. **The same trap fired a third time in the same hour and was
caught only by a byte count**: the before/after harness takes its level list from
a `LEVELS` env var, an invocation that omitted it printed NOTHING, and the diff
against a real 385-byte baseline would have been read as "the fix changed
everything" — the mirror of the recorded case where two EMPTY files compared
IDENTICAL. Assert a result file is non-empty before believing any comparison,
in either direction. Dosed HP-preservingly into **L39 w8** as a straight swap for
the Loose Screw (6 screws 570hp → 5 sparklers 600, sweet 72 → 70): wave hp 3942 →
3940, a −0.05% drift, backbone 84.8%, one special at 15.2% — so the ±25% budget
curve and the composition contract are untouched. It also joins the party
endless pool, giving it two reachable routes for `AUDIT roster`.

**AND THEN I LOOKED AT THE FOUR NEW SCREENS, WHICH NO TEST DOES — two defects,
and my first diagnosis of the second one was WRONG.** Every TD-18 test drives its
feature through `__TD` or asserts a DOM property; that is the same gap that let
the abilities ship with their names only in an `aria-label`. Screenshotting the
🎖️ picker, the 📅 card, the stamped level grid and the 🎇 Sparkler on a live
board found: (1) **the Challenges blurb ended "(on casual at least — that was
measured, not hoped)"** — a note to a colleague about how the feature was
VERIFIED, shipped as player copy. Methodology belongs in the commit message and
here; the dialog should say what the thing does. Guardrailed by a narrow LAW —
player-facing strings may not use this repo's test-suite vocabulary
(`guardrail`, `mutation-proven`, `byte-identical`, `the oracle`, `auto-solver`,
…) — deliberately NOT a fuzzy "is this developer-ish" check, which would be a
false-positive machine, and deliberately not banning `seed`, which is real
player vocabulary on the Daily card. (2) **The Sparkler was the FAINTEST body on
the field**, which is fatal for the one enemy whose whole design is picking it
out early to choose where it dies: 442 ink px against its own sibling the Loose
Screw's 864 and the party backbone Popper's 547, because the silhouette law's
dark ink rim was swallowing a small cyan head. Bigger head, a white-hot core and
the sparks moved inside `noInk()` (a thing that is ON FIRE must not be outlined
in black at its centre) → 590 px. **The first diagnosis was camouflage and it was
refuted by measuring**: the Sparkler is cyan and L39 — its only campaign home —
carries a cyan conveyor, which looked damning in a 4× crop; rendered on the strip
it paints 442 px and off the strip 444 px, so the floor never hid it and the
sprite was simply small. *Look at the picture, then measure the thing you think
you saw.* Three notes on the guardrail, which took three attempts: it is a
COMPARISON (must out-ink the ordinary crowd body it hides among), never a pixel
constant, because this roster's swarm bodies are deliberately tiny so no absolute
floor is honest — the frame-budget ratio lesson applied to art; **the
measurement's RESOLUTION is part of the test**, since the shared context runs at
`deviceScaleFactor: 1` where the whole sprite is ~150 device pixels and the
margin quantized to 13 px (the mutation read **147 vs 147**, two identical
numbers, the signature of a collapsed measurement), so it now opens its own
dpr-3 page; and the controls are asserted non-trivial first, or the comparison
could pass vacuously.

**华丽's PAINTED pass found its first real defect on the device she actually
uses, and the phone-sized test suite could never have seen it.** Every screen in
her world was captured at 390x844 AND at 834x1112 — an iPad, which is what a
70-year-old holds — and 两幅找不同, the one game whose whole task is comparing a
top row of pictures with a bottom row, breaks there: the one-line "▲ 上图 · 下图
哪里不同？▼" label measured 245x45 on the phone and **245x205 on the tablet**,
pushing the two pictures she must compare ~800px apart with a big empty plate
between them. The cause is a good rule over-applying: `.game__stage` is a GRID
whose auto rows stretch to fill a tall screen — deliberate, and the fix for the
documented "a game screen must fill the viewport, no dead bottom half" — and this
game gave it THREE rows, so the free space split three ways and a one-line label
got 209px of it. Fixed by wrapping the trio in ONE stage child, so the stage
stretches one row and the group keeps its own spacing: 36px label and a 40px gap
at 320, 390 AND 834, identical. **Scoped deliberately, on a measurement**: 127 of
240 games have a stretched stage row, and for nearly all of them that IS the
feature working — it is only a defect when the stretch separates the things being
COMPARED, so the comparison game is pinned rather than the stage rule changed
under 240 games. Three testing notes, and the last one is the sharpest. **A
viewport list is the test, for the fifth time** — 390 and 320 both render this
game correctly. **The first guardrail could not fail**: it resized the existing
page with `setViewportSize`, which does NOT reproduce the defect (reverted fix +
resize measured 40px; reverted fix + a FRESH 834 context measured 220px), so it
survived its own mutation; each size now gets its own context, which is how a
real device loads the page, and reverting the wrapper turns it red at 241px. And
**a line I added on a stale reading was measured redundant and deleted**: an
`align-content: center` went in because the wrap's own rows appeared to stretch
in turn (216px), and re-running back-to-back gave identical numbers with and
without it — the 216 was a measurement taken against a stale script. A redundant
fix makes its own guardrail unfalsifiable (the price-flash lesson), so it is gone
rather than shipped as a line whose comment claims work it does not do.
**AND THEN THE SAME STRETCH TURNED OUT TO BE A WRONG-AXIS PROPERTY, which is
why it separated a QUESTION from its ANSWERS across BOTH worlds.** The follow-up
started as a layout pass and ended as a one-line fix, because the cause was not
the stretch being over-applied — it was that the centring the code claimed to do
was never happening. `body.in-game .game__stage` declared `justify-content: safe
center` under a comment saying it "centres the play vertically", and
`.game__stage` is a GRID, where `justify-content` is the INLINE axis. So the
vertical centring was a dead declaration and the grid's auto rows simply
stretched to fill the screen — which looks like filling and is not centring.
Adding the row-axis twin (`align-content: safe center`, `safe` so tall content
still falls back to start-alignment and scrolls) makes the code do what its own
comment says. **Measured ink-to-ink, before and after: games with ≥300px of
visible emptiness between a question and its answers on an 834x1112 tablet went
43 → 0, ≥200px went 75 → 0, and the worst case (Build the Number, 466px) went to
67.** Full suite green, including the 240-game ≥75px tap audit and the every-game
harness — the answer cards do get shorter (Build the Number's went 276 → 76px)
but they are wide, above the floor, and now adjacent to the thing they answer.
**The measurement is the whole story here, and the first version of it was
blind.** A box-to-box gap metric reported "3 of 37" and did NOT list 量词搭配, the
game whose screenshot started this — because the question's own box IS the
stretched row: `.hl-bigline` is a 358px box containing one line of text, so the
box gap reads 24px while the visible emptiness is ~340px. Only an INK metric (a
`Range` over the text nodes, which hugs the glyphs, plus painting leaf elements)
can see it. Guardrailed twice, both mutation-proven: a structural law that the
rule must declare the row axis at all, and a behavioural one asserting the
question-to-answer distance neither exceeds 160px on a tablet nor grows more
than 80px from phone to tablet — the property that actually broke — with an
explicit non-vacuous check that it measured at least five games.

**AND THE PAINTED PASS'S OTHER FIND: her iPad doubled the CELL and kept a
phone-sized PICTURE.** Measured on 834x1112, the pond cells in 池塘数数 grew
79 -> 169px wide while the glyph inside stayed 32px, and 找一找 hid a 35px orange
in twelve 230x90px cards (~5% ink) — so the two games that ask a 70-year-old to
COUNT and to TELL APART small pictures were doing it at phone size on a ten-inch
screen. This is the identical defect Josh's world already fixed for `.choice`
and `.sort__binIcon` ("the bin icon now scales WITH its card"); her world simply
never inherited it, which is the recurring shape — a fix recorded as a one-off
instead of asked "what else has this?". Both rules now use the same
`clamp(min, Nvw, max)` pattern, and **the clamp MIN is each rule's previous
value**, so every phone size renders exactly as before and only the tablet
gains: 32 -> 54px and 35 -> 58px on tablet, unchanged at 390. Guardrailed as a
RATIO between two real renders (tablet glyph >= 1.4x the phone glyph) rather
than a pixel constant, with the phone value pinned separately — because the fix
is only safe if it changes nothing at 390. Mutation-proven: reverting either
clamp reports "32px on a tablet vs 32px on a phone".

**AND THE PAINTED PASS'S REVIEW ROUND FOUND THE PICTURE CHANNEL POINTING AT A
WRONG ANSWER — plus three more games whose pictures ignored her iPad, and one
finding I REJECTED after checking it myself.** 四季分明's prompt strip was
hard-coded `["🍂","🤔","👉"]` while 秋's own answer chip is 🍂, so the icon row
pointed straight at one of the four answers on EVERY round — and since 「腊梅」 is
冬, it pointed at a WRONG one three rounds in four, by construction. Her other
five culture games all use a topic glyph that appears on no chip. **The generic
law was measured and REJECTED**: across all 240 games, 14 have a strip containing
some answer icon, and even narrowed to "the icon of a WRONG answer in a
single-answer quiz" 5 remain (car-wash / hl-tea / plant-care are ritual STEPS;
more-in-scene and left-right name both object types) — all defensible, so a
general rule would need five exemptions, i.e. a fence around the residual rather
than a law. It is pinned as a content truth on that one game instead.
Three more games kept a phone-sized picture on the tablet, the same class as the
pond: 找不同的字/找福字 (`.hl-charchip` capped at 2.6rem while the cards stretch to
224x92 — and that game hangs its whole answer on one ~3px stroke, 日 vs 目),
什么变了 (`.hl-row`) and 谁藏起来了 (`.hl-lineup`), both pixel-identical at 390 and
834. All three clamped with the old value as the MIN, so the phone is untouched;
one guardrail covers all six classes.
**And one finding was REJECTED on inspection, which is what the verify step is
for**: the reviewer measured 照样敲's lit drum at 101px against its 92px
neighbours and called it the documented "a lit cue must not be a `transform:
scale()` on a gapped grid" defect. It is not — that is `cbHit`, a transient 0.3s
bounce shared with Josh's Copy My Beat, and the game's own handler opens with
`if (demoing) return;`, so input is ignored while the pattern plays and the only
other time it fires is on her own successful tap. The screenshot caught a
mid-animation frame. The documented law is about a PERSISTENT lit pad she has to
aim around; a 300ms feedback bounce on a disabled surface is not the same thing.

**THE LAST TWO REVIEW SLICES FOUND A DECLARED RULE THAT NEVER PAINTED, AN
AFFORDANCE INVERSION, AND JOSH'S MEADOW GROWING UNDER HER RED-GOLD WORLD.**
(1) **`.hl-moonchip` has always declared a night-sky background and it was never
applied**: `.game--hl .choice` is (0,2,0) and a bare `.hl-moonchip` is (0,1,0),
so specificity beat source order and the moons sat on the same cream card as
everything else — on the one screen whose question is *how full is the moon*, the
fullest moon was the FAINTEST mark on the page (273 ink px against a crescent's
814). Scoping the selector to match makes the rule do what it has always said.
(2) **A clue is not a control**: `.hl-clue` shared a rule with `.hl-festitem`
giving it a 3px full-strength gold border, against the nine real answer cards'
2px washed gold — so on 按提示找 the one thing she must NOT tap was the most
button-like object on screen, the exact mirror of the peek-cover defect fixed an
hour earlier. It takes the dark plate its sibling 找一找 already uses.
(3) **Josh's meadow was never scoped**: `.screen.game`'s green
`radial-gradient` "soft floor" painted under every one of her red-gold screens as
a hard-edged lighter block (a 20-unit colour step at one edge, 49 at the other),
reading as a stray half-drawn panel, since nothing in her world stands on grass.
Hers is the warm gold her own page already ends in.
**AND THE REVIEWER'S SHARPEST POINT WAS ABOUT MY OWN GUARDRAIL: its game list AND
its selector list were both hand-written**, which is this file's most-repeated
failure mode, committed twice in one sitting. Deriving a replacement took FOUR
measurements, and each wrong one is worth recording. "The biggest thing on the
stage must grow" flags **15 of 37** games, nearly all legitimately (a 300px 福 to
trace, a 96px breathing lotus, and several runs of TEXT, which should not scale
like a picture). The honest invariant is a RATIO — *the card grew and the picture
did not* — and the first three attempts at it measured the wrong element: seeding
the leaf search with the CARD's own font-size measured the card (记忆配对 read
47→54, its `.choice` clamp, while its face and back had really gone 42→63 and
35→54), and seeding with 0 instead dropped every card whose glyph is its own text
rather than a child, taking the sample from 8 games to 1. **And the first bar was
unfalsifiable**: at 0.5 the net passed a mutation that pinned the moon back to its
old fixed size (0.556), i.e. it could not catch the defect it was written for.
Measured floor is now 0.73 with the mutation at 0.556, so the bar is 0.65 —
between the two, not beside them. The two tests are kept as COMPLEMENTARY and the
comment says so: the ratio net catches *card grew, picture did not* and would NOT
have caught 两幅找不同, where NEITHER grew and the ratio stayed a perfect 1.0.

**AND EXTRACTING A ONE OWNER IS HOW THE SIXTH TWO-COORDINATE-SPACE BUG WAS
FOUND.** The Sparkler and the Screw both need "jam the nearest gun", so the
Screw's inline loop became `jamNearest()` — and the moment the two call sites had
to agree, the shipped line read `(t.cx + 0.5 - p.x)`, comparing a WORLD centre
against a raw lane INDEX, while `candidates()`, the dart's sticky-keep and the
mortar all compare raw `t.cx` against `p.x`. That is the sixth instance of this
engine's two spaces one `+0.5` apart, and it was the ONE targeting site that had
it — silently costing the Loose Screw its aim on **28 levels**.
**And the correct fix does NOT ship, because the balance gate — not my
judgement — was allowed to decide, and it said no.** Straightening the aim moves
4 of 18 measured level×difficulty rows (largest: L16 normal `10,14,6,17` →
`10,4,5,5`) and breaks two shipped contracts outright: `PLAYABILITY` (L16
finishes on **4 lives @seed 7** against its ≥5 floor) and `TD7 lever advantage`
(**L31's diversion falls from ≥6 lives to 2** — a sharper Screw makes the thin
board lose on BOTH routes, so the fork stops being worth throwing, the exact
shape already recorded for L31's healer dose: *a difficulty change on a fork
level is also a change to that fork's reason to exist*). The reason it is not
simply a bug fix is that **the Screw's radius and period were tuned AROUND the
bias**, so correcting the space is a stealth buff to a tuned enemy across a
quarter of the campaign, in exchange for nothing a player can perceive. So the
ONE-owner refactor ships (it is what the Sparkler needs, and it is what surfaced
this at all), the legacy aim is pinned as a NAMED parameter — `SCREW_AIM_BIAS`,
passed only by the Screw, while the Sparkler uses the engine's own index space
from birth — and the pin is guardrailed three ways: one owner, only the Screw
passes it, and the constant is proven **load-bearing** by sweeping a shipped map
for a spot where biased and unbiased aim pick different guns (so it can never
decay into a cosmetic 0.5 nobody checks). Byte-identical to the shipped baseline
on all 18 rows, verified. Straightening it is a two-level re-tune with its own
8-seed verification — a commissioned balance pass, not a rider on a feature
batch. Two lessons: **a duplicated computation hides a bug because there is
nothing to disagree with — give it an owner and the disagreement surfaces
itself**; and **a bug whose fix a tuned system was built around is a re-tune,
not a fix** — measure the blast radius before calling it free, and if you defer,
defer with the failing contract NAMED (the rally bias was once deferred on a
measurement scoped to a single level, and that deferral was wrong).

**TWO COMMITS SHIPPED, PASSED, AND NEVER REACHED THE SITE — because CI HUNG, and
a hang is worse than a failure.** Reported by nothing at all, which is the point:
`4c98dee` and `df77afc` both came back `cancelled` and the live site quietly kept
serving `abf31db`. The cause was `npx playwright install --with-deps chromium
webkit` stalling — the measured norm on this repo is **57 seconds** (run #301,
the last green one) and run #304 sat on it for **92 minutes** and was still
going. The damage is not the lost time. `deploy.yml` is `concurrency: group:
pages, cancel-in-progress: false`, so a hung run **holds the group for up to
GitHub's 6-hour ceiling and drops every push queued behind it as `cancelled`** —
one stalled download silently un-shipped two commits of finished work. Four
things worth keeping. (1) **The deploy watchdog could not help, and must not be
widened to.** It exists for the sibling failure (a push that creates NO run) and
its entire safety argument is that it stops the moment a run EXISTS — hung,
failed, anything — so it can never become a dispatch storm against a genuinely
broken build. Covering hangs there would trade that away; the cure belongs at
the source. (2) **So the install is now bounded and retried** through ONE
composite action (`.github/actions/install-browsers`) that both jobs use, with a
per-attempt `timeout --signal=KILL` and 3 attempts: a stall becomes a retry, and
a download that will not come becomes a fast red you can SEE. It is one owner
rather than a line in each job for the reason this repo keeps paying for — the
retry cannot exist in one copy and be missing from the other. The per-attempt
bound is 20 min — and the number is worth keeping because it was RE-MEASURED
TWICE the same day it shipped, the second time by 12 seconds. It went out at 12 min, justified as ~60% headroom over the
slowest healthy install then on record (7.5 min); within the hour the CDN's bad
day produced healthy installs of 5m45s and 10m01s, which made the shipped bound
20% headroom over reality rather than 60%. **A bound that is too TIGHT is its own
bug** — it kills a download that was nearly done and starts over — so it is 15
min now — and then a healthy verify-live install took **14m48s**, clearing that
15-minute bound by TWELVE SECONDS, so it is 20 min. **A bound running at 99%
utilisation is not a bound, it is a coin flip** — the retry keeps it self-healing
rather than red, but it still throws away a download that was seconds from done
and pays for it twice. A 6-hour hang is still a bounded, visible failure. The
lesson generalises past CI: a threshold justified against the worst case you have
SEEN needs re-checking the first time you see a worse one — and once was not
enough here, so check it again after it has run in anger. (3) **A regex
could not have caught what was actually wrong with it.** The first cut read
`code=$?` immediately after an `if`, and a failed `if` condition with no else
leaves the compound statement's own status of **0** — so `code` was always 0,
the HUNG branch could never fire, and a real exit 7 was reported as "failed with
exit 0", which would send the next person hunting a broken install instead of a
stalled network. Found by RUNNING the script against a stubbed `npx`, and now
pinned by a behavioural guardrail that drives the shipped script text
(substituting only the two timing constants, after asserting those constants
exist so the substitution cannot silently no-op) and asserts a permanent hang
ends red with three HUNG warnings while a fail-fail-succeed ends green on
attempt 3. Mutation-proven by re-introducing the `$?` bug itself. (4) **Driving
it also found a second, smaller bug the same way**: it backed off after the
FINAL attempt too, adding a pointless 60s that makes the failure timing read as
yet another stall. **`timeout-minutes` on the caller step is the backstop, not
the mechanism** — composite-action steps cannot declare one, so the bound has to
live in the script.

**TD-19 (a soundtrack, an early warning, and undo) — and the two most useful
things in it are a feature I did NOT build and a bug I did NOT have.**
(1) **A marker that appears when the thing happens is not a warning.** The 🚪
side door was already drawn, but only for waves IN FLIGHT plus the one queued
during build — i.e. it lit up at the moment your gold was already committed,
which is why it kept being reported as unanticipatable even after being "fixed"
twice. It now also warns for the wave AFTER the queued one (during a wave, the
next one), so a flank always costs you a full build phase of notice. **The
DESIGN was settled by a screenshot, not by reasoning**: the first cut was a
0.44-cell dashed ring, which at the real 27px cell read as a smudge among the
props and blue pads — useless as a warning. It is a radar ping now (a filled
hotspot, a bar across the lane, and a ring that expands and fades on a 1s
cycle), in a warm red-orange no floor, pad or lane in any world uses.
(2) **A clause can be empty for the WRONG reason.** "A door already shown as
active must not ALSO be warned" passed on L2 — where wave 6 simply has no door,
so the assertion was vacuous. L26 is the level that can actually test it (waves
12 and 13 open the SAME door), and the test now uses it. The mutation that
removes the exclusion is red only because of that second level.
(3) **The score is DATA and the arrangement is a PURE function**, which is what
makes a soundtrack testable at all: `DATA.MUSIC` + `TDLogic.musicStep(i, ctx)`
returns voices, so per-world keys, the build/wave thinning and the boss's minor
scale are all asserted in node with no audio. The player is then proven
SEPARATELY in a browser (toggle → composer → `JoshAudio.tone`), because a pure
test cannot see a dead toggle. Ten worlds now have ten keys; build strips the
march to its strong beats and drops the percussion; a boss forces the minor
scale and adds a drone once per phrase, and so does DANGER — a run down to
~30% of the lives it STARTED with (a proportion, because ❤️ Extra Hearts can
start you at 24) gets the same tense voice, deliberately, since the message is
"this is serious" and two separate moods would make both less legible. That one
matters most of the four, because during a wave you are watching the field and
not the lives counter.
(4) **I nearly documented a bug that never existed.** Calling `TDLogic.musicStep`
from td-main (whose module alias is `TD`) looked like the classic silent death
behind the composer's try/catch, and I wrote that up — then the mutation that
re-introduces it stayed GREEN, because `TDLogic`/`TDData` are globals and
resolve fine from inside the IIFE. Using the module's aliases is a consistency
fix, not a bug fix. **Run the mutation before believing your own story about a
bug**, or you leave the next reader hunting a failure that never happened.
(5) **↩ Undo: a TIME window was the wrong rule.** Sell pays 80%, so a mis-tap
costs a fifth of the tower — the most common way to lose gold in this game. The
first cut allowed a full refund for 8 seconds, and 8 seconds of a tower SHOOTING
is real value, so that is renting a gun for free. Tying it to the BUILD PHASE
instead (and clearing it in `callWave`) makes the exploit *not exist* rather
than be small, and is more generous at the same time — the whole build phase
rather than a countdown. `lastBuild` is deliberately a CLOSURE var, not a field
on `state`: undo is a UI affordance, so hashState stays untouched and a resumed
run correctly offers none, exactly like `leverCd`. Both paths go through ONE
`removeTower()`, so undo cannot forget the blocked-enemy release that `sell`
remembers.
(6) **Two QoL items were dropped on inspection, which is the point of looking
first.** Auto-pause on backgrounding was already shipped — and had NO test, so
"build it" correctly became "cover it" (the guardrail asserts the ENGINE stops
advancing, not an internal flag, and both halves are mutation-proven). And
"remember the last tower line" was dropped because the build menu is already one
tap per line: it would have saved exactly zero taps while looking like an
improvement.
**"A LIST THAT OUTLIVES ITS CONTENTS" HAS NOW HAPPENED FOUR TIMES, so it is a
guardrail rather than a habit.** The recorded three were PLAN_WORLD_9 saying
DESIGNED-NOT-BUILT after the world shipped, the "ideas for more games" list being
entirely built, and this file's own open-items claiming 华丽's painted pass was
still open a release after it landed. The fourth was found by deriving it:
**`PLAN_WORLD_4.md` said "Status: NOT SHIPPED" while all four attic levels were
live under exactly the names it lists** — and its other half, 🧸 Kid Fort, had
since been RETIRED, so the doc was stale in both directions and would have sent
the next author to build a world that exists and revive a mode deliberately
removed. The same sweep found the repo tree had stopped naming
`PLAN_WORLD_4.md` at all (and, earlier the same day, `deploy-watchdog.yml`).
Two things worth keeping. **The tree half is precise and derived** — walk
`scripts/tests/tools/styles`, every workflow, every `PLAN_*.md`, and require each
to be named, plus the reverse (a name in a tree ENTRY must exist, comments
excluded because they legitimately cite paths outside the repo). **The plan-status
half had to be scoped HARD, because the loose version is exactly the
false-positive machine this repo refuses to ship**: matching "NOT SHIPPED"
anywhere in a header flagged two CORRECT docs — PLAN_MINIBOSS, whose "NOT BUILT
AS CONTENT" is an accurate refutation that merely names shipped levels while
discussing where a finale could go, and PLAN_WORLD_4's own corrected header,
which contains the words while EXPLAINING that it used to say them. So it reads
the status VERDICT (the first bolded token after `Status:`) and compares it
against the one unambiguous fact available: whether the world key the doc names
has levels in `DATA.LEVELS`. Mutation-proven three ways, and the tightening is
proven not to have simply silenced it, because a legitimate NOT-BUILT doc still
passes.
**And the WATCHDOG was asserting a proxy too, so it was rewritten to assert the
property.** It existed for the sibling silence (a push that fires NO run) and
bailed the moment any run existed — which is exactly why it was blind to this
one, where runs existed and simply never published. "A run exists" correlated
with "the site is current" right up until a run could exist without shipping.
It now fetches the live page and compares against main's head, with four
independent brakes that a broken build must cross NONE of: a run still active
(wait, never race it), any run FAILED (leave it red — that is the whole
difference between a watchdog and a retry loop), a `workflow_dispatch` run
already present (one kick per commit), and an UNREACHABLE site treated as
unknown rather than stale, so a network blip can never trigger a deploy. And
because a structural scan proves a call site exists and only driving the thing
proves it fires, the shipped `script:` body is now EXECUTED against stubbed
`github`/`core`/`fetch` across ten scenarios — mutation-proven three ways:
deleting the failure brake makes it storm a red build, deleting the unreachable
guard makes a blip deploy, and short-circuiting the live check makes it useless.

**THE GUARDRAIL I WROTE TO CATCH "THE CARD GREW AND THE PICTURE DID NOT" WAS
ITSELF SCOPED TO ONE WORLD — the defect it is named for, committed inside the
test.** It ended `.filter((g) => g.hl)`, so it walked her 40 games and none of
Josh's 200, and Josh plays on an iPad too. Measured across his games the next
day: **64 of 96 picture-card games were below the same bar all 8 of hers now
pass**, with the signature stark — `card 109→229px, picture 35→35px`, a glyph
that does not move while the card doubles. Five things worth keeping.
(1) **Group the failures by the CSS RULE, not by the game, before touching
anything.** 64 games looked like 64 fixes; grouped by the element actually
carrying the picture it was **33 elements, and `.choice` alone accounted for 27
of them** — its `clamp(2.4rem, 12vw, 3.4rem)` simply hit its cap, since 12vw
only reaches 3.4rem above ~453px. Raising that one max took 64 → 34.
`.find__cell` (7 games) was a flat `2.2rem` with no clamp at all.
(2) **The phone is unchanged BY CONSTRUCTION, not by hope.** For a flat size the
replacement is `clamp(CURRENT, (CURRENT_px/3.90)vw, 1.5×CURRENT)`: the vw track
lands exactly on the min at 390 and below it at 320, so both phone widths
compute the identical pixel value and only a big screen can gain. Verified
directly — 320/390/414 byte-identical, 600/834 +29%, zero horizontal overflow at
any width. For a rule that ALREADY clamps, raise only the max, which is safe
wherever the vw track was already deciding; the one exception is worth naming,
because `.house__piece`'s max was binding at 390 already, so it moved +1.3px —
measured and accepted rather than assumed to be free.
(3) **The exemption is DERIVED, and it is principled rather than a fence.** Four
games set `fontSize` INLINE per round because the size IS the answer (find the
tiniest star, smallest-to-biggest, will it fit?). CSS cannot scale an inline
style, and scaling it *would change the puzzle* — bigger absolute differences on
a tablet make the discrimination EASIER — so keeping them absolute is arguably
correct, not a compromise. The test skips any card whose picture carries an
inline font-size, so it names no game, and the mutation that deletes the
exemption goes red, i.e. it is load-bearing rather than decorative.
(4) **Three of the four games whose phone value "moved" were measurement NOISE**,
and they identified themselves: they are exactly the inline-sized ones, whose
round is random, so their glyph differs run to run. A before/after diff over a
randomised surface needs that check, or noise reads as regression.
(5) The widened scan costs ~110s because it walks 240 games at two viewports —
paid deliberately, since the alternative is a scan whose scope is a list.
(6) **A guardrail folded into an existing walk inherits that walk's FILTER, and
mine silently covered 104 of 240 games.** The ratio scan returns early for a game
with no picture card, so folding the tablet overflow check into it quietly scoped
that check to the games that happen to have one. Both the overflow and the tap
halves apply to EVERY game, so they are returned unconditionally now and a
`>= 200` count assertion makes a future early-return fail loudly instead of
narrowing the scan again. Also from the same pass: a shared failure is usually
ONE css rule, so a message that names 160 games is a wall nobody acts on — it
names eight and counts the rest.
(7) **And the clamp pass's whole effect landed in the one width class nothing
audited.** It only changes anything above ~453px wide, while the shipped
overflow audit runs at 390 and 320 — so 121 games got a bigger glyph at a width
no test measured. Walked at 834: 0 of 240 overflow, 0 page errors. The check is
now folded into the ratio scan's own 834 pass, which was already loading every
game there, so it costs nothing; mutation-proven by forcing a tablet-only
overflow, which flags 100 games. **When a change is scoped to a condition, check
whether anything actually tests that condition** — a green suite means less than
it looks like when the change is invisible to every viewport in it.

**THE FORT'S PORTRAIT LAW WAS PINNED AT SEVEN PHONE WIDTHS, AND ADDING THE IPAD
"FAILED" — BUT THE DEFECT WAS IN THE CLAUSE, NOT THE PRODUCT.** The law says the
battlefield gets every pixel, and enforced it as `wrapW >= viewport.width`; at
768/834/1024 portrait that clause goes red, because the 720px game-screen cap
applies to the fort's play screen too. The obvious reading is "the cap is taxing
the field". **Measured, it is not: excluding the fort from that cap moves the
canvas by exactly 0px at all three widths** (504x864, 546x936, 700x1200 before
and after). The board is HEIGHT-limited on a tablet — the canvas is 546px inside
an 834px box — so the cap cannot bind, and shipping the CSS "fix" would have been
a redundant change whose own guardrail could never fail, the trap already
recorded twice here. **`wrapW >= width` is a PROXY that tracks the real property
on a width-limited phone and stops tracking it on a height-limited tablet** —
"when a check asserts X, assert X, not a quantity that correlates with X today",
now landing on a check written in this repo rather than on someone else's.
So the clause became the property itself (the container is not what is squeezing
the field) and the tablet sizes were added rather than exempted. Two further
lessons. **The first replacement was UNFALSIFIABLE and only the mutation found
it**: it read `canvasW > wrapW - 2`, and a canvas does not grow to exactly its
box — it sits ~8px inside — so a 400px cap that really does squeeze the field
546 -> 392px sailed straight through. The rule held again: when a mutation
passes, do not widen the tolerance, go and print what actually moved. The bar is
now a MEASURED separation rather than a slack (healthy tablet 546/720 = 0.76, a
binding cap 392/400 = 0.98, so 0.90 sits between them), and it is proven on BOTH
halves — restoring the phone's side padding and adding a tablet-binding cap each
turn it red. And **the tablet sizes earn their place independently of that
clause**: the one-control-row rule, the no-page-scroll rule and the adult 44px
floor are now checked at an aspect (0.75) nothing had ever run, against the
phone's 0.46, on a renderer that rotates its floor 90 degrees in portrait.
**Its sibling had the identical gap, and that one guards something that cannot
be recovered from**: `AUDIT: no pad hides under ANY floating field control`
carries a comment saying in as many words that *the viewport list IS the test* —
and listed eight phone/landscape sizes and no tablet portrait. A pad buried
during BUILD is permanently unbuildable, and the board's cell size is derived
from the viewport, so every pad's screen position moves with the aspect: a
control that misses every pad at eight phone shapes says nothing about a ninth.
Measured CLEAN at 768x1024 and 834x1112 (0 buried across all 50 maps), so this
is coverage rather than a fix — and proven non-vacuous by floating a control
over the field at tablet widths only, which fires at exactly the new size and
names the pads. When a test's own comment says the list is the test, the list is
also the thing to go back and extend.
**The THIRD fort audit was measured and deliberately NOT extended, which is the
other half of that lesson.** `AUDIT: every fort overlay lands ON SCREEN` also
lists only phone/landscape sizes, and all 9 dialogs measure clean at both iPad
portrait sizes — but the reason to leave it alone is structural, not the clean
number: an overlay goes off screen when the viewport is SMALL (too tall for
320x568, too wide for 320), so tablet portrait is the roomiest case and the
least able to catch anything the existing list already would. Compare the
pad-burial audit, where the tablet ASPECT genuinely relocates every pad on
screen and so is a real new failure mode. **"Extend every viewport list" is not
the law; "the list is the test" means ask what each size can uniquely catch** —
and adding one that can catch nothing is the fence-around-the-residual this file
keeps refusing.
**And a REFACTOR was proposed, measured, and dropped in the same pass: `--tap`
is a FLOOR, not a scale.** The tightest tap in Josh's world is `.feed__snack` at
76px against a 75px audit floor, which looked like an accident until it turned
out to be `min-height: var(--tap)` and `--tap: 76px` — the project's own token.
Ten CSS rules hard-code `76px` rather than reading it, which is the documented
"a size declared twice has no owner" class (`.td-abil` at 52 vs 60), so the
obvious move is to convert them. Six of the ten genuinely mean "a tap target";
four are art or display rows (`.build__friend`, `.wh__row`, `.hl-runtile`,
`.hl-maskbtn svg`) that correctly keep their own value. But the conversion is
behaviourally identical today, so it only earns its place if the token can be
proven LOAD-BEARING — bump `--tap` and every tap must grow. **Measured, that law
is false: at `--tap: 120px`, 190 of 240 games have a tap that does not follow,
led by `.choice` in 151 of them, because `.choice` sets its own `min-height:
96px` — deliberately ABOVE the floor.** A component choosing to be bigger than
the minimum is correct, so there is no coherent property for the refactor to
establish, and it would be an unfalsifiable change of the kind this file already
deleted twice (the redundant price-flash paint, the bed-glyph clamp). No change
shipped. What IS true and already guarded is the thing that matters: no tap
anywhere falls below 75px, now checked at 320, 390 AND 834.

---

## Repository Structure

A plain static site — no framework, no build step. Tests and CI are the only
tooling.

```
.
├── index.html                  # The whole site: front door (#screen-start, 3 world tiles) + Josh's launcher shell; all other screens injected. Also carries the ONE shared `.jart-defs` block — 3 ALPHA-ONLY shading gradients (jart-lit/dome/ground) that every JoshArt picture references by stable id (per-picture defs collapse — see the learnings)
├── manifest.webmanifest        # PWA manifest (installable, standalone, icons)
├── sw.js                       # Service worker (network-first; offline; precaches core)
├── assets/                     # PWA icons (192 / 512 / maskable-512 / apple-touch)
├── styles/
│   ├── main.css                # Josh's + 华丽's styling (safe-area, static bg, ≥75px tap targets)
│   └── td.css                  # 🏰 Fort Josh styling (adult-sized controls, canvas field, overlays)
├── scripts/
│   ├── content.js              # ALL editable content/data (dual-export: window.JoshContent + module.exports). Edit here.
│   ├── logic.js                # PURE, deterministic game logic (window.JoshLogic + module.exports) — unit-tested
│   ├── effects.js              # Shared JoshEffects.confetti()/stars() (celebrations)
│   ├── audio.js                # window.JoshAudio — voice (speechSynthesis) + mute state (off) + iOS-safe tone() + win/good/bump CUES (mute-gated)
│   ├── art.js                  # window.JoshArt — original homage SVG (hero/pup/numberFriend/friend/truck/rocket/fixable-scenes/…), lit from the upper LEFT (the fort's own LIGHT) via `lit()` + index.html's shared gradients; NO <defs>, NO <filter>, every ref carries a ` none` fallback
│   ├── stickers.js             # window.JoshProgress (THE owner of josh-won-* flags) + window.JoshStickers.artFor (deterministic sticker per game)
│   ├── buddy.js                # window.JoshBuddy (THE owner of josh-buddy) — pick-a-companion roster + home companion + themed win art
│   ├── framework.js            # Game registry + screen chrome + shared game API + the TEST CONTRACT
│   ├── games-toys.js           # Self-registering games: gentle cause→effect toys
│   ├── games-math.js           # Self-registering games: counting, build, skip-count, take-away, compare, coins
│   ├── games-literacy.js       # Self-registering games: first sound, rhyme, build-a-word, sight word
│   ├── games-logic.js          # Self-registering games: odd-one-out, patterns, shadow, order, memory
│   ├── games-science.js        # Self-registering games: sorters (living/color/land-air-water/day-night/hot-cold)
│   ├── games-calm.js           # Self-registering games: breathing, certificate, trace-path, 2 co-op games
│   ├── games-fun.js            # Self-registering games: bubbles, peekaboo, balloon, music pad
│   ├── games-find.js           # Self-registering games: find-the-heroes, spot-the-one, count, dot-to-dot, rescue, tic-tac-toe
│   ├── hl-content.js           # 华丽 (Grandma Huali) — ALL Chinese content/truth (dual-export: window.HualiContent + module.exports)
│   ├── games-hl-a.js           # 华丽's games (一): 麻将牌艺 6 · 诗词成语 6 · 记忆锻炼 4 · 心算算术 4
│   ├── games-hl-b.js           # 华丽's games (二): 记忆 +2 · 心算 +2 · 民俗文化 6 · 眼明手快 5 · 静心时光 5
│   ├── hl-main.js              # 华丽's shell: red-gold launcher + 🏮 sticker book (opens directly from the front door's 👵🏻 tile — no gate)
│   ├── td-data.js              # 🏰 Fort Josh (Jon's TD): ALL balance/content truth (dual-export) — towers/56-enemy roster (35 + 21 per-world backbone SKINS) + 10 bosses/40 levels (10 worlds; one fork+lever per world: L3/L7/L10/L15/L19/L23/L27/L31/L35/L38)/gimmicks + WORLDS presentation map (label/spawnGlyph/`backbone` — the ONE declaration `BACKBONE_TYPES`, the generator and the composition audit all derive from) + meta (TD-8 deep star tree: 3 branches × 40 nodes/140⭐ (vs the 120⭐ ceiling 40 levels create — 20⭐ of headroom) against a 6-slot per-run `metaSlots` loadout, 18 achievements, one endless arena PER WORLD, each with its OWN mini-boss rather than ten Piñatas) + a per-world `floor` (pattern/palette/road tint/props triple) + P3 `chargePerWave`/`chargeMax` (⚙️ Toy Energy) + P6 `abilitySlots` (the 5-power pool the strip picks 4 of) + TD-18 `CHIPS` (the 4 opt-in run constraints; a fifth banning the Dart was CUT by measurement — see the comment beside the list)
│   ├── td-logic.js             # 🏰 PURE deterministic engine (30Hz fixed-step, seeded RNG only, zero DOM; dual-export for node sims) — TD-7 lane-aware (paths[]/pathIdx, pullLever); TD-15 waveIdx=cleared vs sentIdx=sent, so waves can OVERLAP (callInfo/⏩ RUSH); guide truth DERIVED from data (enemyTraits/reachedBy/levelGimmicks) + pure floor-prop placement (propCells — a new enemy or gimmick documents itself or the coverage guardrail fails) + pure `laneCoverage` (what share of the lane a pad reaches, validated against real damage) behind the engine's `coverageOf(line, tier, cx, cy, branch)`, the ONE owner the build menu and tower panel read; P3 ⚙️ energy budget + 🧨's reveal rider through the ONE `isHidden` gate + ⚡'s crash (frozen across a build phase); P4 records the run's equipped loadout on `state.meta`; P6 records the run's equipped POWERS on `state.powers` (`abilityReady` refuses `not-equipped` first) and 📌's `markId`/`markUntil` override every mode through the ONE `pickByMode` + the dart's sticky-KEEP; TD-18 run CHIPS are pure input like meta/powers, refused in the FIRST clause of `place()`/`abilityReady()` (never in the UI), and `jamNearest` is the ONE owner the Loose Screw and the 🎇 Sparkler share
│   ├── td-render.js            # 🏰 canvas renderer (reads state, never mutates; lerps between ticks) — a struck body FLASHES (warm tint via the ctx.fill interception + a reduced-motion-gated scale pop, keyed on the hit event's `id`) and a killed one POPS (the real sprite, squashed and fading, in the character pass) + TD-6 screen-shake (reduced-motion-gated) + opt-in damage numbers + TD-7 multi-lane ribbons + lever button + PER-TIER tower art (T1/T2/T3 + all 6 tier-4 branch silhouettes) built on the shared `TOY` material kit (sheen/bolt/tape/plank/tube — one toybox language a 5th line inherits; every line its own SILHOUETTE, cross-line-distinctness guardrailed) and one draw branch per enemy (both pixel-hash guardrailed); `withInk(fn, lit, flash, pens)` splits the CHEAP dark pen from the DEAR `clip()`-based lit edge, so a many-shape sprite gets a full contour without buying a clip per bolt (`setTowerPens` proves the shipped budget SATURATES)
│   ├── td-ui.js                # 🏰 screens/HUD/overlays (opens directly from the front door's 🏰 tile — no gate; controls stay data-adult) + TD-5 star-tree/badges/endless overlays, P6's 🎒 Powers picker, TD-18's 🎖️ Challenges picker + 📅 Daily card, resume banner, achievement toast; the level grid + the power strip both DERIVE from data (grid = every shipped level; strip lives OFF the field)
│   ├── td-main.js              # 🏰 glue: JonTD routing + jon-td-* save (meta/loadout/powers/ach/endlessBest/bests/midRun/chipsArmed/chipsWon/daily) + rAF loop + input + sfx + achievement tracking + endless/resume + window.__TD test hooks
│   └── main.js                 # Front door (#screen-start: 3 world tiles) + launcher (category menu + Surprise tile + 📖 Sticker Book + ⭐ badges) + hash router ('' = start, #home = Josh) + sound + SW; routes td-* through JonTD (try/catch-isolated)
├── tests/
│   ├── site.test.js            # node:test structure/wiring/content/guardrail checks (no browser)
│   ├── art.test.js             # UNIT tests for scripts/art.js — every kind is a well-formed 100x100 svg, numberFriend is countable, hero is a figure not a blob, the 200 Sticker Book prizes are all distinct, and the shared-gradient contract (no per-picture <defs>, only ids index.html declares)
│   ├── content.test.js         # CORRECTNESS: ground-truth restatement — answers can't silently go wrong
│   ├── hl-content.test.js      # 华丽 CORRECTNESS: poems/idioms/zodiac/量词/festivals/dishes/seasons truth tables + no-gate lock + FU_PATH tap geometry
│   ├── logic.test.js           # deep unit tests of scripts/logic.js (seeded RNG, exhaustive)
│   ├── e2e.test.js             # Playwright (Chromium) — GENERIC harness plays EVERY game + toddler-chaos double-tap guardrail
│   ├── mobile.test.js          # Playwright iPhone (real WebKit in CI) — overflow + ≥75px audit on home AND every game
│   ├── offline.test.js         # Playwright — drops the network and proves the PWA fully boots from the SW cache (no dead shell)
│   ├── td-logic.test.js        # 🏰 headless engine sims: determinism, combat math, wave-budget audit, L1 winnable-by-script AND losable-by-neglect
│   ├── td.test.js              # 🏰 Playwright: front-door entry (no gate), routes, real build taps, scripted victory via __TD, defeat, pause/speed, kid-isolation, no-overflow
│   └── helpers.js              # shared: locate a browser + serve the site (or JOSH_BASE_URL for live)
├── tools/                      # NODE-ONLY dev tools (not loaded by the site) — the
│   │                           #   balance work in CLAUDE.md was produced by these,
│   │                           #   so they live in the repo instead of a scratchpad
│   ├── td-sim.js               # 🏰 measure any level with the SHIPPED oracle (normal/heroic/casual × seeds, + losable-by-neglect incl. the full star tree). `node tools/td-sim.js 13,17`. NEVER tune against a stronger solver — that is what got World 4 reverted. `--lever` measures what a fork's lever is WORTH (a thin build that LOSES on the short route and WINS with it thrown) — the right way to choose between fork candidates, since longest != best. `--priority` is the DECISION-aware arm (blind/spend/focus; `FREE=1` isolates a decision from its price) — judge on focus-blind, NEVER focus-spend: a control arm that costs something is not a control. `--branch` is the only thing that can measure a TIER-4 BRANCH at all — both oracle plans fill with `t.tier < 3`, so neither has ever called `branch()`, which is how Sticky Bomb shipped promising goo it never left. It buys only from SURPLUS after the board is full and maxed (a strict superset of the oracle, not a different player), `CAP` (default 1) is how many of the line convert because an all-in arm is the mortar-mono shape, and it PRINTS `bought` — four separate fixture bugs in its scratch version each reported "the branch is worth nothing" on a working engine, and every one of them presents as an arm identical to the control.
│   ├── td-wave-gen.js          # 🏰 emit + validate wave tables against BOTH contracts (±25% budget curve; ≥70% backbone / ≤1 special ≤25% / valve ≤12% / plain openers). `--check` audits every shipped level against the contracts it was AUTHORED under. The data file is written LAST.
│   ├── td-elite.js             # 🎯 does a BOSS-SCALE body move a flat level? HP-preserving concentration/elite swap over the last N waves, judged by the shipped oracle × 8 seeds. `LEVELS=27 HEAVY=__elite ELITE_HP=900 FRACS=0,0.35 node tools/td-elite.js`. This is what proved crowd cannot bite and boss-scale can.
│   ├── td-gold.js              # 💰 what a MAXED board does with its gold — fills every pad, upgrades to T3, takes a branch (the shipped oracle stops at T3, so it cannot see this), and reports the wave the board becomes UNSPENDABLE. `SWEEP=1` sweeps bounty. This is what measured the 21-of-36 dead-stretch finding.
│   ├── td-map-search.js        # 🏰 search lanes + pads against every geometry law (≥0.99 from EVERY lane, ≥1.4 pairwise, ≥1.9 from a lever, ≤BAND from the lane it must COVER), all in cell-index space. Edit the literals, run, paste into td-data.js.
│   ├── td-fork-search.js       # 🏰 which shipped maps admit a SECOND lane with no pad moved? Enumerates axis-aligned detours and keeps only those passing every shipped fork law (shared prefix, real divergence, ≥1.15× longer, every pad ≥0.99 from BOTH lanes, ≥1.9 from the lever). `node tools/td-fork-search.js 15,23`.
│   ├── td-miniboss.js         # 🧪 is an ADDITIVE elite a real lever? Judges on the doser's four rules PLUS spread, because "the median moved" is exactly what a disguised constant does. Reproduces the two recorded nulls before measuring anything new. Six shapes measured, all constants — see PLAN_MINIBOSS.md; the tool is kept so the seventh idea is one command, not a re-derivation.
│   └── td-threat.js            # 🏰 THREAT-SHAPE doser. `SPREAD=1 node tools/td-threat.js` DERIVES the target list (per-level min/median/max/spread over 8 seeds) — the flat-level list must never be a remembered one, and spread is the signal, not the value: a level reading 19 on all eight seeds is as much a disguised constant as one reading 20. `node tools/td-threat.js` audits which counter each level's late game never asks for; `node tools/td-threat.js 22,26` grid-searches (wave × dose) for a swap. Screens on 4 seeds, CONFIRMS on 8 (two doses looked clean on 4 and lost heroic on 8), and the confirm set is ranked by HEROIC HEADROOM — heroic is the binding axis, and ranking on normal movement twice confirmed the wrong candidates. SKIPS fork levels (a fork's difficulty IS its lever's value — L31 measured beautifully and broke `TD7 lever advantage`), never ADDS hp and never drains the flier group. In the repo for the reason the fork sweep sat open two releases: a scratch script gets thrown away and the item becomes unactionable.
├── package.json                # `npm test` → `node --test` (runs unit + e2e + mobile + offline)
├── package-lock.json           # committed for reproducible `npm ci` in CI
├── .claude/
│   ├── settings.json           # SessionStart hook registration (project scope)
│   └── resync-main.sh          # heals a container that came back on a STALE clone:
│                               #   fast-forwards ONLY when strictly behind origin/main
│                               #   with a clean tree; never touches dirty or ahead.
├── .gitignore                  # ignores node_modules etc.
├── .github/
│   ├── workflows/
│   │   ├── deploy.yml          # CI: test (unit+e2e+WebKit) → deploy (cache-busts assets) → verify-live
│   │   └── deploy-watchdog.yml # every 30 min: does the LIVE SITE serve main's head? Covers both
│   │                           #   silences — a push that fires no run, and a run that exists and
│   │                           #   never publishes. Four brakes stop it looping (active run / any
│   │                           #   FAILED run / already dispatched once / site unreachable).
│   └── actions/install-browsers/
│       └── action.yml          # the ONE owner of `playwright install` — a GitHub-hosted browser
│                               #   cache (so the flaky Playwright CDN is off the critical path)
│                               #   plus a per-attempt `timeout` + 3 tries, so a stalled download
│                               #   is retried and never HANGS. A hang holds the `pages`
│                               #   concurrency group for 6h and silently drops every push behind
│                               #   it (it un-shipped 4c98dee and df77afc).
├── JOSH_PROFILE.md             # WHO JOSH IS: skill levels, non-reader law, friends, interests, game-mechanic menu — READ before building
├── josh-profile.json           # ^ same profile, machine-readable (for programmatic game generation)
├── PLAN_ROAD_TO_140.md         # Set 1 build plan (40 games, waves W1-W4) — ✅ BUILT (Josh at 140)
├── PLAN_ROAD_TO_180.md         # Set 2 build plan (40 MORE: pick-place, toggle-match, reveal, co-op echo, waves W5-W8) — ✅ BUILT (Josh at 180)
├── PLAN_ROAD_TO_200.md         # Set 3 build plan (20 MORE gap-fillers: numeral trace, syllables, blending, compounds, analogies, measurement, life cycles, scene-zone, dump truck, waves W9-W10 + audit) — ✅ BUILT (Josh at 200)
├── PLAN_TOWER_DEFENSE.md       # 🏰 "Fort Josh: Toybox Defense" — Jon's adult TD world: full design (engine/towers/enemies/12 levels/bosses/meta/tests). Historical note: the plan's "Jon" name gate shipped, then was removed by request 2026-07 (front-door tile instead)
├── PLAN_WORLD_4.md             # 🧳 ✅ BUILT: World 4 "the Attic" — L13-L16, the Tickmaster. Its header said
│                               #   NOT SHIPPED for several releases after the world went live (the
│                               #   list-outlives-its-contents class). Its real value is the FIRST attempt's
│                               #   REVERT: never tune against a solver stronger than the suite's. The plan's
│                               #   other half, 🧸 Kid Fort, was later RETIRED whole — do not rebuild it.
├── PLAN_WORLD_6.md             # 📦 ✅ BUILT: World 6 "Moving Day" — L21-L24, 🧻 Bubble Wrap (bonkResist — the Couch Cushion's mirror, and the first hard counter to the Dart), 📻 Boom Box (a hurry aura), The Moving Van boss, a 6th endless arena. §9 records the step function reproduced a THIRD time, and warns that a 7th world breaks the star-tree guardrail.
├── PLAN_GIMMICKS.md            # 🎛️ ✅ BUILT: TD-16 level gimmicks — 🕳️ mud patch (the conveyor's data field mirrored), ⚡ power pad (a socket that buffs whatever is built on it), 🚪 side door (a wave group that enters partway down the lane). §6 records what each is WORTH in lives, the zone-overlap bug, and why a mud patch had to come back off L5.
├── PLAN_EXPANSION.md           # 📈 PARTLY BUILT: phases 1-5 shipped (guardrails that can fail · per-world backbone SKINS + level distinctness · ⚙️ Toy Energy / 🧨 reveal / ⚡ crash · per-run loadout slots · **Worlds 7-8, L25-L32**, with the star tree grown to 105⭐/30 nodes so the ceiling guardrail still holds). Phase 6 (new content) PART-BUILT: **P6a** shipped the ability LOADOUT (`RULES.abilitySlots`, `save.powers`, the 🎒 Powers picker) + 📌 **Call the Shot**, with the critique's corrections applied; **P6b** shipped 🦆 `zapResist`, **P6c** shipped ⛱️ `zones[].dmg`, and **P6d closes the I5 new-enemy item**: of its three bodies, 🪂 Parachute Trooper was cut by the critique (the Tin Plane renamed), 🥫 Pantry Can was cut by MEASUREMENT (a shield is anti-Fan only — see the learnings block), and 🛢️ **Oil Drum shipped** on a positional axis instead of a resist. The spec was found NEEDS_CHANGES on 16 counts (`scratchpad/specs/10-crit-content.md`); note that its critique was itself wrong about the shield arithmetic, so treat both as claims to measure. §0 is the star-ceiling finding — its arithmetic is stale (Worlds 9 and 10 shipped, and the tree grew by BREADTH to 140⭐ against the 120⭐ that 40 levels create), but the LAW it states still binds: grow the tree before the campaign, or the must-cost-more-than-you-can-earn guardrail goes red; several of its own premises were refuted by measurement, and the corrections are in this file's learnings block.
├── PLAN_TOWER_BRANCHES.md      # 🎯 BUILT (phases A-E): "a third ultimate per tower?" — the answer is NOT three-on-every-line (Dart and Fan have a real third axis; Mortar and Camp do not, and every candidate for them duplicates a shipped ability or breaks the guardrailed two-lines-reach-air truth), and NOT a fifth line (~5× the cost for the same feeling). §5 is the real deliverable: all EIGHT shipped tier-4 branches are unverified by the winnability suite — the oracle's fill loop is `t.tier < 3`, so it never branches — which is exactly how Sticky Bomb shipped promising goo it never left. Phases A-C (identity guardrails · a diagnostic-only `--branch` observation arm · deriving the panel's branch buttons) are pure infrastructure worth building even if no new branch is ever added. §8 is the do-not-build list.
├── PLAN_ENEMY_ESCORT.md        # 🌫️ BUILT then CUT: the decision-axis probe. Phase 1 shipped the decision-aware oracle (`tools/td-sim.js --priority`) and it killed the enemy before it was built — targeting priority measures ZERO even free, even on the Junk Healer, so 🌫️ Dust Bunny is not built. §6 is the report; §§2-4 are the refuted design, not a backlog.
├── PLAN_WORLD_10.md            # 🎉 ✅ BUILT: World 10 "The Party" — L37-L40, the world that exists because a
│                               #   FINALE is the only lever the difficulty axis has left (PLAN_MINIBOSS §5b), and a
│                               #   boss may only headline a world's fourth level. 🎁 The Big Present is the first
│                               #   boss to carry `hurry` — it does not hit you, it makes the party ARRIVE FASTER.
├── PLAN_WORLD_9.md             # 🏭 ✅ BUILT (this line said "DESIGNED, NOT BUILT" for a release AFTER the world shipped — the "a list that outlives its contents" class, caught 2026-08 by reading DATA.LEVELS instead of the doc): World 9 "The Toy Works" — L33-L36, the loop-closing world (the step after the sort line is the factory that melts you down into a new toy). §0 records the star-ceiling blocker as CLEARED (123⭐ tree vs a 108⭐ ceiling, margin 15). §3 carries lane+pad literals for all four levels AND the arena, all output by `tools/td-map-search.js` and passing every geometry law — nothing eyeballed. It must land as ONE commit: a half-built world breaks the per-world guardrails and puts unreachable content on the grid.
├── PLAN_WORLD_5.md             # 🔧 ✅ BUILT: World 5 "The Garage" — L17-L20, 2 new threat shapes (slow-immune Grease Racer, capped-load Bolt Bucket), the Toolbox Titan boss, a 5th endless arena. §11 records what shipped AND the four negative results (bypass shapes, air pressure, conveyor, boss hp) with their measurements.
└── CLAUDE.md                   # This file
```

> **To change any wording, animals, or colors:** edit `scripts/content.js` only.
> `content.js` works both in the browser (sets `window.JoshContent`) and in Node
> (`module.exports`), so the tests assert the real content.

Update this tree whenever files are added or moved.

## Current Site Behavior

The app opens on **the front door** (`#screen-start`, the empty-hash route): a
start page with **three giant world tiles** — Josh's `JoshArt.friend` portrait →
his 200 games (`#home`), 👵🏻 → 华丽's 40 Chinese games (`#hl-home`), and 🏰 →
Fort Josh (`#td-home`). **Each tile navigates directly — the old name gates
(华丽 / "Jon") were REMOVED by request (2026-07)**; the worlds are open, and
each world's home has a way back to the front door (Josh's 🚪, her 🏠, the
fort's exit). A junk/unknown hash clears to the front door.

Inside Josh's world: a **launcher home screen** (`#screen-home`) on a
**static** sky→meadow→sun gradient: a big grid of friendly game **tiles** (icon
carries the meaning; a short label is for the grown-up). Tapping a tile opens
that game via the URL hash (`#game-id`) so the phone Back button works; a big
**🏠 Home** button returns. A giant **sound toggle** 🔇/🔊 lives in the top bar — **sound is OFF by
default** (remembered as `josh-muted` in `localStorage`; iOS blocks autoplay
anyway). Sound is the *primary instruction channel* when on (spoken prompts +
a 👂 "hear it again" button), but every game is fully playable with sound off
(icon strip + worked example + self-naming pictures).

**200 games** across Josh's skill map (see `JOSH_PROFILE.md`), each on the
shared framework, all no-fail / no-timer / ≥75px targets — and every one
winnable, so the 📖 Sticker Book tops out at a full ⭐ 200/200. The home screen is a
menu of **7 categories** (icons carry the meaning); tapping one opens that
category's games. (Set 3 added the last 20 — measurement, syllables, oral
blending, compounds, analogies, life cycles, scene-zone hunts, and the namesake
dump truck. Set 2 — the middle 40 — added six NEW interaction shapes:
**pick-and-place** [`.held` hand-off, one flag at a time], **toggle-to-match**
[light cells until a grid matches a model], **progressive reveal** [self-paced
peek then answer], **path-choice** [tap a whole route], **pictograph/representation**
[read a graph or coin pile], and **co-op echo** [leader shows, follower copies]):

- **🔢 Numbers** — Count & Feed, Build a Number, Hop & Count (2s/5s/10s), How
  Many Are Left? (take-away), Which Has More?, Penny Shop (money), Add It Up,
  Find the Number, What Time?, Build the Number (place value), Ten & Some More
  (teen), Set the Clock, Make Ten (number bonds), Add Big Numbers (2-digit
  addition), Piggy Bank (coin value), Which Is Bigger? (compare numerals),
  **Fair Shares** (deal treats equally — early division), **Quick Peek**
  (subitizing behind a self-paced cloud), **Hop the Line** (number-line jumps),
  **Nickel Trade** (5 pennies → a nickel), **Double It!** (doubles), **Longer or
  Shorter?** (measurement), **Count Down** (10→0), **Balance It** (seesaw
  compare), **Count the Sides** (shape sides). *Set 2:* **Coin Mix-Up** (count a
  nickel + pennies, then the nickel bursts into 5), **First, Second, Third!**
  (ordinal words), **More or Fewer than 5?** (number sense, never exactly 5),
  **The Fruit Graph** (read a pictograph — most/fewest), **Fullest Glass** (volume
  compare), **Partner Up!** (pair the ducks → even or odd). *Set 3:* **Number
  Maker** (trace digits 1-5), **Duck Pond Stories** (acted-out spoken addition),
  **How Tall?** (measure a thing in unit blocks).
- **🔤 Letters** — Beginning Sound, Which Rhymes?, Spell the Word (CVC), Find the
  Word (sight words), sh or ch? (digraph sort), Big & Little Letters, Missing
  Letter, Read & Zap (read a word → tap its picture), Rhyme Train (find every
  rhyme), sh/ch/th? (finish the word), Letter Maker (trace letters), **Spell My
  Name** (tap J-O-S-H / friends' names in order), **Alphabet Train** (the
  missing letter in an A-B-?-D window), **Ending Sound**, **The Missing Middle**
  (CVC vowels), **Word Family Houses** (rimes), **Letter Pairs** (big↔little
  memory), **Build the Sentence** (word order), **Silly Stories** (listen for two
  details), **ABC Dot-to-Dot** (connect A→B→C… to reveal a picture). *Set 2:*
  **Spell the Big Word** (4-letter CVC decoding), **Two-Letter Teams** (st/sn/fr
  blend sort), **Little Letter Maker** (trace lowercase c·o·s·v·w), **Word Pairs**
  (sight-word concentration), **Rhyme Pairs** (memory where a pair is two pictures
  that rhyme), **Name Balloon Hunt** (pop the letters of J-O-S-H → the name
  assembles). *Set 3:* **Two Words Make One** (compound words — sun+flower),
  **Drum the Word** (syllable count via a self-paced drum), **Robot Talk** (oral
  blending — the robot says c-a-t, tap the cat).
- **🧠 Thinking** — Which is Different?, What Comes Next? (patterns), Match the
  Shadow (SVG shapes), Small to Big, Memory Match, Put in Order (numbers), What
  Changed?, Color by Number, Who Is It? (2-clue deduction), Picture Squares
  (mini sudoku), Put in Order (story sequencing), **Look From Above**
  (bird's-eye / top-down spatial), **Which Piece Fits?** (the tap-only jigsaw),
  **Who Hid?** (cloud-hides-one elimination memory), **Copy My Beat** (echo a
  drum sequence — order only, never timing), **Which is Different?** (opposites),
  **Fix the Pattern** (interpolate the missing middle), **Finish the Grid**
  (2-attribute matrix), **Left or Right?** (side discrimination), **Count the
  Blocks** (single-height iso), **Which One Turned?** (mental rotation). *Set 2:*
  **Copy My Picture** (toggle a 3×3 grid to match a model), **Finish the
  Butterfly** (mirror-symmetry toggle), **Will It Fit?** (relational size),
  **Which Path Leads Home?** (unbroken-route choice), **Peek & Copy** (self-paced
  peek, then recreate), **Who's Behind the Curtain?** (partial-info inference —
  distinct silhouettes only). *Set 3:* **This Goes With That** (picture analogies
  A:B::C:?), **What's Missing?** (visual closure — a drawn part is gone),
  **Drive Home** (route planning across forks — pick the unblocked road).
- **🔍 Find It** — Find the Heroes, Spot the One, Count Them All, Dot to Dot,
  Paw Patrol Rescue, Find the Twins (one matching pair), I Spy: Find Them All
  (category hunt), The Big One (two-clue color+shape hunt), **Web Rescue**
  (clear webs to free trapped friends — occlusion reveal) — his favorite,
  harder each round — and **Letter Hunt** (pop every balloon with the target
  letter; lowercase twins sneak in once he ramps), **Number Hunt** (pop the
  target numeral), **Star Search** (count-up hunt), **Whose Tracks?**
  (inference), **More in the Pond** (count & compare in a scene), **Little
  Detective** (two-clue deduction with self-checking fade). *Set 2:* **Match
  Them All** (face-up pair-clearing — pick-and-place), **Find the Tiniest**
  (size-discrimination hunt), **Count the Animals** (categorize-then-count),
  **Sandwich Shop** (find the foods among silly non-foods), **Treasure Hunt!**
  (position-word clues assemble a chest). *Set 3:* **Fix the Toys** (rejoin split
  halves — part-whole), **Shape Spy** (find every circle/square/triangle in a
  scene), **Hide & Seek!** (find friends by their peeking clues), **Dino Dig**
  (brush away sand, then identify the buried find).
- **🔬 Science** — Alive or Not?, Sort the Colors, Land/Air/Water, Day or Night?,
  Hot or Cold?, Shape's Real Twin (3D solids), Will It Stick? (magnetic sort),
  Land or Water? (globe), Where Do They Live? (continents, self-checking map),
  Make an Island (build & name landforms), **Find the Shape** (2D plane shapes),
  **Animal Homes** (single-continent ID, no map giveaway), **Plant or Animal?**,
  **Mix It!** (pour two paints → the REAL mixed color), **Sink or Float?**
  (predict, then the tub proves it), **Mama & Baby** (match baby↔mama), **Who
  Says Moo?** (animal sounds), **Awake at Night?** (nocturnal sort), **Fast or
  Slow?** (speed sort), **Who Eats This?** (animal diets — no distractor is also
  an eater), **Simon Says: Touch!** (body parts on a figure — geometry-tested
  zones). *Sort the Colors* scales to a 3-color bin in later rounds; the
  sink/float and plant/animal facts share ONE truth set with Alive-or-Not (single
  source, guardrail-tested). *Set 2:* **See, Hear, Smell!** (the five senses →
  body part), **Who Uses This?** (community helpers' tools — exclusion-listed),
  **Grow a Flower** (plant needs — water-then-sun ritual), **What Made This?**
  (weather-cause inference), **Whose Home Is This?** (nest/web/hive → dweller).
  *Set 3:* **Baby to Big!** (life cycles — egg→caterpillar→butterfly), **Fur,
  Feathers, Scales** (animal coverings sort), **Where Does It Come From?** (food
  origins — milk→cow).
- **🎉 Fun & Play** — Hi Animals!, Pop the Bubbles, Peekaboo!, Pump the Balloon,
  Music Pad (sound via shared iOS-safe JoshAudio.tone), Grow! (stack a
  Numberblock friend 1→10), **Thwip! Web Up** (web up the bugs — Spidey), **Thwip
  the Villains** (web up the silly baddies — no-fail cause→effect, uses
  `VILLAINS`), **Dress Me!** (weather → the friend visibly gets dressed),
  **Season Windows** (fly each item into its season), **Fireworks Show** (tap the
  sky → a burst; counts them), **Silly Face Maker** (cycle a hat / face /
  glasses), **Web Swing!** (tap the numbered buildings in order — hero hops
  across), **Birthday Cake** (add 5 candles, then blow them out — his Feb hook).
  *Set 2:* **Hatch the Egg!** (tap to crack → a surprise baby animal — toy),
  **Splat Studio** (paint blobs, name the color — toy), **The Car Wash** (soap →
  scrub → rinse → dry, the car visibly cleans up). *Set 3:* **Dump Truck!** (the
  namesake — load rocks, count, pull the DUMP lever), **Puppy Love** (nurture toy
  — pat/brush/treat), **Boing! Boing!** (bounce Josh's chosen buddy ever higher).
- **🤝 Calm & Friends** — Breathing Star, I Did It! (certificate), Follow the
  Path (lacing), Team Hop, **Team Number Tower** (count to 10 together), **Team
  Count by 2s** (skip-count co-op), **Team Countdown** (5→0 blast off), Team
  Bridge, Team Treasure (co-op find), Team Sound Hunt (co-op beginning sounds),
  Memory Together (co-op concentration), Tic-Tac-Toe (2-player co-op), **Friends
  Race** (take-turns skill race — answer *which rhymes?* to move your racer;
  first to the flag, everyone celebrates), **How Do They Feel?** (name the
  feeling, then one helping breath — SEL), **Kind Helpers** (tap the kind thing
  to do), **Day Train** (the week in rainbow order), **Team Story Time** (co-op
  sequencing), **Quiet Garden** (a calm bloom toy), **Team House Build** (co-op
  construction), **Hello Around the World** (each friend greets in their heritage
  language — River 你好, Viraj Namaste, Raegar Privet, Josh Hello), **Team Pizza
  Party** (deal 6 slices → a fair 3-and-3), **Grandma's Visit** (find Grandma's 3
  things among Josh's toys — a warm bridge to 华丽's world, closing on a
  spoken 谢谢). *(The tap-to-fill co-ops now each carry a real skill — skip-count,
  countdown, counting — not just turn-taking.)* *Set 2:* **Month Train** (the
  months in order), **Set the Table** (pick-and-place practical life), **What
  Goes First?** (getting-dressed order), **Team Puzzle** (2-player pick-and-place
  jigsaw), **Team Song** (2 players play Twinkle's notes in order), **Team
  Balance** (2 players level a scale — equality), **Copy Me!** (2-player
  leader/follower echo), **The Worry Box** (SEL — tuck each worry away), **Thank-You
  Hearts** (gratitude — every choice is right). *Set 3:* **Tidy Up Time** (put
  each toy in its home bin — practical life, pick-and-place).

### 👵🏻 华丽的世界 — the world for Josh's Chinese grandma

A **second mini-site for Grandma Huali (华丽)**, entered through the front
door's 👵🏻 tile, which opens `#hl-home` **directly** (the old Chinese name gate
was removed by request 2026-07 — `hl-ok` and the gate strings are gone, and a
`site.test.js` lock keeps them gone). Inside, the page turns
**red-and-gold** (`body.hl-mode`) and ALL text
is simplified Chinese, sized and paced for a 70-year-old: **40 games** in 7
categories (🀄 麻将牌艺 6 · 📜 诗词成语 6 · 🧠 记忆锻炼 6 · 🧮 心算算术 6 ·
🏮 民俗文化 6 · 👁️ 眼明手快 5 · 🍵 静心时光 5), her own 随便玩 (Surprise) tile
and a 🏮 sticker book (40 slots, Chinese-motif stickers, meter to 40/40).

How it works (keep these invariants):
- Her games register through the **same framework** via each file's `reg(cat, def)`
  helper, which stamps `def.hl = true` (never in Josh's menus/Surprise/book),
  `def.lang = "zh"` (Mandarin voice via `A.say(t,{lang:"zh-CN"})` + praise/
  try-again/Again strings from `HualiContent`), `def.hlCat` and `def.homeHash`
  (Home returns to HER category). Ids are `hl-` prefixed. All of this is
  guardrail-locked in `site.test.js`.
- Because they're framework games, the **generic e2e harness plays all 40 to a
  win** and `mobile.test.js` audits every screen (≥75px at 320px — so no button
  grid may exceed 3 columns) with zero extra per-game test code.
- **Progress is shared machinery, separate worlds:** her wins are `josh-won-hl-*`
  (same `JoshProgress` owner), her ⭐ badges/sticker slots fill live off the same
  `josh-won` event — but Josh's grown-ups reset **preserves** her stars, his
  Sticker Book counts only his 200, hers only her 40 (both guardrail-tested).
- **Correctness bar is identical:** `tests/hl-content.test.js` restates the
  cultural ground truth (the 5 Tang poems verbatim, real idioms + forged-idiom
  check on distractors, 生肖 order, standard 量词 pairs, festival↔custom bins
  with no dual-membership, regional dish↔city, season membership, the waxing
  moon, 宫商角徵羽 ascending) so no answer can silently go wrong.
- Every screen (nav + game) is openly deep-linkable — her home 🏠 returns to
  the front door, and a junk `#hl-*` hash clears to the front door without
  leaving her red-gold theme painted.

### 🏰 Fort Josh: Toybox Defense — the world for JON (dad)

A **third world**: a real tower-defense game entered through the front door's
🏰 tile, which opens `#td-home` **directly** (the old "Jon" name gate was
removed by request 2026-07 — `td-ok` and the gate UI are gone, with a
`site.test.js` lock keeping them gone). This is still an **adult-DESIGNED
space**: real difficulty, real defeat screens, real timers — RULE 5's kid tap
laws deliberately do not apply inside (its controls are adult-sized
`data-adult`; the front-door tile itself is kid-sized). Status: **COMPLETE
(TD-1 … TD-6 all shipped)** — shell +
deterministic engine + **all 40 Levels across 10 worlds** (Bedroom L1-4, Backyard
L5-8, Toy Store L9-12, Attic L13-16, Garage L17-20, Moving Day L21-24, **🏠 The New
House L25-28** (the reprise world — 🪑 Flat-Pack Chair and 🔑 Spare Key skins on a
pale drop-cloth floor, The Housedog boss) and **♻️ The Sort Line L29-32** (the step
AFTER being kept — 🧃 Juice Carton, 📎 Runaway Clip and the campaign's first
EXCLUSIVE flier 📄 Loose Leaf, on steel grating with a dark rubber-belt lane; The
Big Magnet), **🏭 The Toy Works L33-36** (the loop closes — the step after being
sorted is the factory that melts you down into a new toy; The Stamping Press) and
**🎉 The Party L37-40** (the one world where the chain runs the OTHER way: the new
toy is wrapped and GIVEN, so it is the brightest floor in the game — 🎊 Party
Popper / 🍬 Loose Sweet / 🎏 Stray Streamer on confetti carpet with a paper-chain
lane, and 🎁 The Big Present closes the campaign as the first boss whose kit is a
`hurry` aura: it never hits you, it makes the party ARRIVE FASTER); distinct
path/pad layouts, each
proven winnable by a headless best-of-two auto-solver + losable by neglect, and
L12 winnable on Heroic; beat level N to unlock N+1, ▶ Next-level on the victory
screen; the fort home shows world tints, difficulty pips, and a 👑 on each boss
finale. **Stars/progression are PER-DIFFICULTY ladders** (user request 2026-07):
`save.stars = {casual:{},normal:{},heroic:{}}` — the grid shows the SELECTED
chip's stars/locks, a win lands on the RUN's difficulty (`st.difficulty`, not
the chip at win time — a resumed run may differ), a legacy flat map migrates to
`normal` at boot AND in the two-tab merge, while the star-tree budget,
Star-Collector/Full-Fort and the endless unlock read BEST-per-level across
ladders so the 36⭐ economy is unchanged and no old save loses anything), the FULL enemy roster — World-1 (Sock/Marble/Balloon + Mud Blob
[splits→Mudlets], Plastic Knight [armor → Fan zap], Wind-up Bull [charges when
hit], Junk Healer [mends allies], Piñata [gold-burst], Brick squads) **plus
World-2/3 (Glitter Ghost [phases untargetable], Battery Bot [regenerating shield
eats Zap], Digger Mole [tunnels the middle third — untargetable/unblockable],
Kite Hawk [fast flier])** — and **three bosses**: Bed Monster (L4, unblockable
stomp), **Vacuum King (L8, inhales the nearest soldier + enrages under half hp)**,
and **The Static (L12, hp-gated phases: 50% armor → jams a random gun → summons
Battery Bots + dashes)**. Every ability is a data field the engine reads through
ONE `dealDamage`/`killEnemy` path (split/charge/heal/goldBurst/stomp) + a
`bossTick` (suck/disable/summon) + `isHidden` (phase/tunnel), all guardrail-tested.
Three level gimmicks land too: **night** (−15% Dart/Mortar reach, Fan exempt, with
a dark firefly floor), **conveyor strips** (a speed zone shoves enemies along,
drawn as scrolling chevrons), and the mole **tunnel**. And the FULL arsenal: 4
tower lines (Dart/Mortar/Fan/Army-Guys Camp) × tiers 1-3 + all six exclusive
tier-4 branches (Sniper/Minigun, Bertha/Sticky, Blizzard/Static-chain, Dino/RC),
slows (strongest-wins, fliers half), brittle, splash with falloff + min-range,
chain lightning, seeded crits, spin-up, and path-blocking soldiers with rally
flags. The renderer draws the FLOOR rotated 90° in portrait so the battlefield
fills the phone while CHARACTERS stay upright (one worldToScreen mapping shared by
drawing/taps/dialogs). **TD-5 META** adds the between-runs layer: a **star
tree** — grown by **TD-8** into a DEEP tree: **3 themed branches (🎯 Firepower /
💰 Economy / 🏰 Fortification) × 23 nodes costing 77⭐ total vs the 36⭐
ceiling**, so allocation is a permanent real choice (guardrail: total must
exceed 36 — the original 10-node tree cost 28 and went fully-bought with dead
stars). Ranked skills (Sharp Darts/Piggy Bank/Extra Hearts/Big Booms/Tough
Troops II — rank II requires rank I, highest rank wins in `metaMods`), 5 new
abilities (🪙 +8% bounty at the ONE killEnemy site; 🍀 dart-line +3% crit — the
rng draw only happens when a chance exists, so meta-less streams keep their
historical hashes; 🦉 night penalty halved via the engine-exposed `rangeMul`
the renderer's preview reads; 🐕 respawn ×0.75 through one `respawnTicks`
helper covering BOTH KO paths; 🩹 +1 life every 5th cleared wave, never above
start, skipped on the winning wave so stars can't inflate), and a 👑 capstone
per branch behind ⭐8 in-branch spend (👊 bosses +15% in the ONE dealDamage
path; 💵 +12 gold after every cleared wave; 🌟 the first leak each run costs 0
lives — the leak still emits, so "No Leaks" stays honest). Refunds CASCADE
(dropping rank I drops rank II and any capstone whose branch spend fell) so
`save.meta` never goes inconsistent; the original 10 node ids/costs are
UNCHANGED so old saves keep exactly what they owned; still a **free respec**,
threaded through
`createEngine` as PURE INPUT (`opts.meta`) so a sim covers any loadout; **12
achievements** (`jon-td-ach`, toast on unlock, one per boss + First Blood/No
Leaks/Pea Purist/Ice Age/Star Collector/Full Fort/Marathoner/Heroic Heart);
**Endless mode ×3** (a per-world arena with a deterministic wave generator —
budget `300·1.16^n`, a mini-boss every 5th wave, each world's spike being its
OWN body rather than ten identical Piñatas — unlocked once a world's 4
levels are 3⭐, best score saved per world); and **resume mid-run** (a
wave-boundary checkpoint in `save.midRun` → a Resume banner on the fort home that
cold-restores the build). **TD-6 POLISH** finishes it: a full audio-cue set
through `JoshAudio.tone` (a distinct mortar THUMP vs dart TICK vs a crit sparkle,
plus build/upgrade/sell/zap/leak/wave/boss/win/defeat) with an optional looping
lullaby-march behind its own toggle; **fx juice** — a ≤4px screen-shake on
boss/Bertha/splash impacts that's fully DISABLED under `prefers-reduced-motion`,
plus opt-in floating damage numbers (pause-menu toggles for both, off by default);
and a perf check (the engine ticks sub-millisecond even on a maxed 14-tower
board). **TD-7 MULTI-PATH** (the last deferred subsystem, now shipped): the
engine is lane-aware — a level may define multiple `paths[]` and each enemy
carries a `pathIdx`, positioned/targeted/leaked on its OWN lane (single-path
levels stay byte-identical: `paths=[path]`, every `pathIdx` 0). The lever now
ships on **exactly one level in each of the 10 worlds** (L3, L7, L10, L15, L19,
L23, L27, L31, L35, L38 — guardrail-locked, so an 11th world cannot ship without one). **L10 "The Train
Set"** is the set piece: two lanes share a prefix then split at the fork
into a SHORT default track and a LONG loop that rejoins the short tail; throwing
the 🔀 **track-switch lever** (`pullLever`, 8s cooldown) sends the incoming train
the long way — the same tail towers hit it far longer (a thin build that LOSES on
short WINS with the lever). The renderer draws every lane (the switch-track in
cool steel-blue beneath the warm default) + the lever button (ready/cooldown +
which way it's thrown); a real field tap throws it. **Lever readability (user
feedback 2026-07): a persistent TOGGLE's state must be readable on the FIELD,
not only on its control** — the lever is deliberately a railway switch (pull →
the route sticks until pulled again after the 8s cooldown; committed routing is
the level's strategy and its sims assume it), but the only indicator was a tiny
thrown-arm on the button, so a thrown lever read as "stuck on long". Now
`drawLeverRoute` lights the whole ACTIVE route with running golden dashes
(static under `prefers-reduced-motion`, frozen while paused — animated off
`state.tick`), veils exactly the CLOSED branch's divergent middle (never the
shared prefix/tail, which belong to both routes), and the button names its
state ("SHORT WAY"/"LONG WAY"); `render.leverInfo()` is the hook the browser
test drives both ways (the shakeInfo precedent). The fort is now
feature-complete with no deferrals. **TD-9 IN-WAVE ABILITIES** adds the one
missing pillar: until now EVERY decision lived in the build phase, so once you
hit CALL you were a spectator — which is also why the difficulty audit could
only ever move the opening. Four abilities (`DATA.ABILITIES`, driven by
`engine.useAbility(id, {x,y}|{towerId})`) now give the player a mid-fight lever:
🧨 **Toy Box Drop** (splash where you tap — honours `isHidden`, so a phased ghost
is still untouchable), 🍯 **Sticky Floor** (a LIVE zone in `state.puddles` that
re-slows whatever walks in, through the one `applySlow`), ⚡ **Overclock** (a
tower fires 2× for 8s via ONE `boostOf(t)` read at every cooldown-set site, so a
future tower line inherits it free), 📣 **Rally Horn** (every downed soldier
straight back up) and — added by P6 — 📌 **Call the Shot** (every gun on the board
aims at the body you tap for 5s, through the ONE `pickByMode` plus the dart's
sticky-KEEP). Two deliberate design laws: each costs **gold** as well as a
cooldown, so an ability is a real trade against a tower rather than free power
(it can't silently inflate the curve — the auto-solver never uses them, so every
winnability sim stays conservative and needed no re-tune); and all of them are
**pure deterministic** (tick-stamped cooldowns, zero rng), so a headless sim
drives each one and an ability-using run still replays byte-identically. The
pool is larger than the strip, so a run EQUIPS `RULES.abilitySlots` of it (the
🎒 Powers picker on the fort home; `save.powers`, one owner in `activePowers()`).
**TD-10 THREAT SHAPES** generalizes the flier lesson with four enemies that each
break a different one-line board — 🛋 **Couch Cushion** (`splashResist` applied in
the ONE `dealDamage` keyed on `how`, so mortar splash AND the Toy Box Drop both
land at 40%), 🔩 **Loose Screw** (jams the NEAREST shooting gun in reach — nearest
not random, so it's a readable emergency and costs no rng draw; camps are bodies,
not electronics, and are immune), 💧 **Drip Slime** (`slowHeal` — it regrows WHILE
slowed, so a fan-only board holds it still for ever and never kills it) and
✈️ **Tin Plane** (flies AND is armored). Swapped in HP-preservingly, so the ±25%
budget contract is untouched, and every level stays winnable on all three
difficulties and losable by neglect. Two honest results came out of it, both
guardrail-locked: **L7 is DELIBERATELY exempt** — it is the air-pressure level and
the sim showed it already sat at its heroic ceiling (8.7 lives), so *every* new
shape flipped it to unwinnable on heroic; and the **Tin Plane did NOT fix
dart-mono**. It was built to (armor halves bonk; the Fan's zap is not bonk, so
zap cuts through), but the measurement refused the theory: dart-only won **12/12
before and after**, and `dart+1fan` is strictly *worse* (10/12, 11.4 lives vs
15.3) because massed dart DPS beats the armor penalty and a pad spent on a Fan
costs more than the zap gains. Recorded rather than papered over — note the
defect classes differ: mortar-mono winning was a CONTRADICTION (a board that
cannot hit air beat air waves), dart-mono winning is just the generalist being
viable. **A later full sweep CLOSED this item, and the answer was that the
question had been asked at the wrong difficulty.** Measured over all 16 levels ×
3 seeds: on NORMAL, dart-mono clears 16/16 (avg 14.9 lives) against the mixed
plan's 16/16 (15.2), while camp-mono manages 3/16, mortar-mono 2/16 and fan-mono
0/16. But on HEROIC the matrix BINDS — dart-mono clears only **10/16** and the
fixed mixed plan **13/16**, and each wins levels the other loses (L4/L7/L14 need
the dart swarm; L3/L5/L9/L10/L12/L15 need the mix), so **no single plan is
universal**, and their union is exactly what keeps `PLAYABILITY` honest. The Dart
being a forgiving generalist is therefore a property of *normal* — which is what
normal is for — not a balance defect needing a 16-level re-tune. The other lesson
came from trying to guardrail it: **a test that cannot fail is worse than no
test.** The first attempt asserted "mortar/fan/camp-only must lose a late level",
and it survived even a mortar mutated to 4× damage AND able to hit air — because
mortar-mono loses STRUCTURALLY (its 1.5-cell minimum range leaves a dead zone
under the tube, so a mortar-only lane leaks at any damage). It was replaced by
the two things that ARE falsifiable, both mutation-proven: a truth-table test of
the fields the Toybox Guide derives from (exactly two lines reach air; only the
Mortar has a minimum range, at every tier; the Fan deals no bonk, which is why
its zap ignores armor), and a two-level heroic sim pinning the split.
**TD-12 ONBOARDING** makes the counter matrix visible for the first time. The
heart of the game — only Dart and Fan reach air, armor halves a dart's bonk, a
shield eats the Fan's zap, a Cushion soaks splash, a Slime regrows while slowed —
was never stated anywhere. Two surfaces now say it, and both are DERIVED from
the enemy's own data fields via `TDLogic.enemyTraits(def)` / `reachedBy(def)`, so
a new enemy or a new trait explains itself and the guide can never drift from the
engine (guardrail: every special field an enemy carries MUST produce a trait
line, or a mechanic ships invisible). **📖 Toybox Guide** on the fort home gives
every enemy a card (stats · what can hit it · its tricks); the **defeat screen**
— previously flavour ONLY, no diagnosis at all, despite the engine emitting every
leak — now names the wave, lists what got past you, and when your board had a
real blind spot says so ("Nothing you built could even reach the Kite Hawk"),
with a 📖 link that opens the guide scrolled to the thing that beat you.
Systemic fix that came out of it: **an overlay parked on a HIDDEN screen is
itself hidden** — the guide opened from the defeat overlay (play screen) rendered
as nothing, because `metaOverlay` hard-coded `#screen-td-home`. Both overlay
factories AND the toast now go through ONE `hostScreen()` that picks the
unhidden screen, both screens are positioning contexts, and a `site.test.js`
guardrail bans hard-coding either host again. Caught by a browser test; invisible
to reading the code.
**TD-13 RUN STATS** answers "which towers actually carried?" for the first time —
a summary on BOTH outcome screens showing damage **by line** as bars, kills, gold
earned, towers built/spent, and your personal best. The implementation lesson is
the important one: **a run tally must live in engine STATE, not in the event
stream.** The obvious build (accumulate as events drain) is wrong twice over —
only the DART ever emits a `hit` event, so splash/zap/melee damage would be
credited to nobody; and `emit` caps the buffer at 400, so a scripted or headless
run that simulates a whole wave before draining silently loses most of it (L12:
634 kills, but the capped buffer retains **zero** die events at the end). So
`state.dmgBy / kills / goldEarned` are tallied in the ONE `dealDamage`/
`killEnemy` path, attributed through one `HOW_LINE` table (`how` already names
the source at every call site: dart / splash=mortar / zap=fan / melee=camp /
ability), which means no call site changed and a future tower line is counted the
moment it routes through there — and a node sim can assert the numbers directly.
`save.bests` is keyed `level:difficulty` (independent ladders — a casual clear
must never overwrite a heroic best) and is the THIRD instance of the
persisted-field law, so it was covered at all three sites (loader defaults,
`freshSave`, the two-tab merge, where a best folds as a MAX like stars) with a
guardrail pinning each.
**TD-18 BETWEEN-RUNS** adds the replay layer the campaign was missing, all four
pieces built on seams that already existed. **🎖️ Challenge chips** (`DATA.CHIPS`,
armed on the fort home) are opt-in run CONSTRAINTS — 🔇 Quiet Hands (no powers),
🥵 Heat Wave / 🧺 Crates Packed / ⛺ Camp's Closed (no Fan / Mortar / Camp) —
threaded through `createEngine` as pure input beside meta and powers, refused in
the FIRST clause of `place()`/`abilityReady()` so the engine owns the rule, and
recorded per level in `save.chipsWon` so a beaten level wears the chips it was
beaten under. Because a chip only ever removes an option it cannot inflate the
curve, and `chips: []` is a proven default-noop. **📅 The Daily Toybox** is one
endless arena + one chip + one seed, all three chosen by hashing the calendar
date, so every player gets the same puzzle on the same day; it scores on its own
ladder (`save.daily`: today's best + all-time) and deliberately writes NO mid-run
checkpoint, since a resumable daily is a re-roll. **Per-world endless mini-bosses**
replace the ten identical Piñatas — each arena's every-5th-wave spike is now a
body from its own world, gated by a guardrail requiring it to be at or above its
pool's median hp. And **🎇 the Sparkler** is the Loose Screw's mirror on the
decision axis the Oil Drum opened: it jams the nearest gun where it DIES
(`jamBurst`, through the ONE `killEnemy` and the ONE `jamNearest`), so *where*
you break it is the choice. Like the Drum it measures outcome-neutral on the
shipped oracle and ships for legibility, not for the curve.
**THE RETRY DID NOT RETRY — and the guardrail that drives the shipped script
text was GREEN while CI was red, because a test is only as faithful as its
ENVIRONMENT.** Run #320 ended `exit 137` with **zero** `::warning::` lines: the
signal that ended attempt 1 also killed the SHELL running the loop, so attempts
2 and 3 never happened and a deploy was lost to exactly the stall this action
exists to survive. `timeout` signals a process GROUP, so whether the parent
survives depends on the runner's process-group topology — and no local harness
reproduces it (both a plain `bash script.sh` and a `setsid` one retried
happily here, three times each, which is precisely why the behavioural test
passed). Four things worth keeping. (1) **`--foreground` is the trap, not the
fix.** It reads like the obvious answer and is the opposite: it leaves the
command in the SHELL's own process group, and measured against a stub whose
death signals its group it reproduces #320's exact signature — **exit 137, zero
attempts**. The fix is `setsid --wait`, which puts the attempt in its own
SESSION so no group-directed signal, from `timeout` or from the command itself,
can reach out of it — structural rather than topological. Also TERM with a
`--kill-after` escalation instead of a bare KILL, so the common case shuts down
cleanly and a stuck apt tree still goes with it. (2) **The failure reproduced
so faithfully that it killed the TEST RUNNER**: driving the #320 configuration
took down `node --test` itself rather than reporting, so the harness now spawns
the script under `setsid` too. A harness must isolate the thing it is testing,
or a genuine regression presents as the suite dying instead of failing — and
that is one step worse than a green test, because it looks like infrastructure.
It does not mask the script's own `setsid`, which isolates a level deeper:
dropping that still turns the case red. (3) **The clause and the mutation
disagree about which half is load-bearing, so say so** — dropping `setsid`
alone does NOT go red behaviourally (an ordinary shell topology already
isolates the group); the structural clause is what pins that half, and the
behavioural one pins the mechanism. Two clauses, two different mutations, and
the comment names which is which. (4) **Run #320 is NOT evidence the 25-minute
bound is too small.** The log shows apt going silent for 24 minutes inside
`--with-deps` after fetching InRelease — a stall, which is what the retry is
for — so the bound did its job and the retry did not. That note lives beside
the constant, because the tempting reading of a killed attempt is always
"raise it", and this repo has already raised it three times.

**THE GUARDRAIL PROTECTING THE OFFLINE PWA COULD NOT SEE THE LAUNCHER FALL OUT
OF THE PRECACHE — because it substring-matched the whole file, and the file's
own comment quotes the path.** `sw.js`'s offline-fallback comment explains the
dead-shell bug using the literal `"./scripts/main.js"`, and the test asserted
`sw.includes(s)` for each script — so deleting `./scripts/main.js` from `CORE`
leaves the check GREEN. Verified rather than reasoned: with the launcher
removed from the array the old assertion passes, and offline that is exactly
the documented disaster (the versioned request misses, falls through to the
`index.html` fallback, and the browser parses HTML as JavaScript with
`window.JoshGames` empty). It parses the `CORE` array now, with a `>= 20`
non-vacuity floor. **And the list it checks AGAINST was hand-written**, which
is the same class one level up: `SCRIPTS` feeds the Emoji ≤13.0 scan, the VS16
scan, the canvas-API floor scan, the `Math.random` ban and this precache check,
so a new script file escaped ALL of them at once until someone remembered to
add it — the fourth instance after the VS16 scan's nine files, the flex-gap law
guarding only `main.css`, and the live-verify probe polling only
`index.html`. It derives from `index.html`'s own `<script src>` tags now, so
what the page LOADS is what gets scanned, and a script removed from the page
correctly drops out with it. Two notes worth keeping. **A derivation fails
OPEN**, which is worse than the hand list it replaced unless it is guarded: a
regex that stops matching makes five scans silently vacuous and everything
stays green, so the derivation has its own test (≥20 entries, no duplicates,
every entry shaped like a script path) — mutation-proven by breaking the regex,
which reports "only 0 scripts found". And **the load-bearing proof is M2**: add
a brand-new `<script>` to `index.html` and the suite immediately names it as
missing from the precache, which is the failure the hand list could never
produce.

**THE SOUNDTRACK HAD NO PREDICATE — the wake lock's own bug, one lifecycle
over, in the same file.** `keepAwake`/`letSleep` got `wakeWanted()` + `syncWake()`
precisely because the first cut acquired in `startLevel` and released only in
`stopLoop`, so a paused or quit-from run held the lock for ever. The music
shipped with exactly that shape and nobody noticed: `startMusic()` in
`startLevel`, `stopMusic()` only in `stopLoop`. Two reachable defects fall out.
**Backgrounding the tab auto-pauses the battle and does NOT stop the loop** — so
it keeps scheduling while you are in another app, throttled by the browser to
~1Hz, which turns a 190ms march into an arrhythmic drone. **And quitting to the
fort mid-run played battle music over the menu**, with `musicCtx()` reading a
PARKED run for its build/wave/boss/danger arrangement — the soundtrack
describing a battle that is not on screen. Fixed the RULE 7 way: one predicate
(`musicWanted()`), one owner (`syncMusic()`), and one composed `syncRun()` that
every site calls. Four things worth keeping. (1) **The two predicates
deliberately DISAGREE, which is why they stay separate rather than being
merged** — they agree about a hidden tab and a finished run and differ on
PAUSE, because a pause menu sits OVER a visible battlefield and should keep its
music (which is what games do) while a battle you have navigated away from
should not. Gating the music on "the play screen is not hidden" is the fort's
version of the framework-wide law that all speech and cues gate on
`!screen.hidden`. What is shared is the CALL SITE: `syncRun()` is what every
pause, resume and route takes, so the halves cannot drift the way the lock's
acquire and release once did. (2) **`syncMusic` needs its `!musicTimer` guard**
— `startMusic()` restarts the phrase from bar one, and `syncRun()` fires on
every pause, resume and route, so without it the music stutters back to the top
each time you open the pause menu. (3) **The sweep that rewrites `syncWake()`
call sites to `syncRun()` will rewrite the one INSIDE `syncRun` into infinite
recursion** unless it is corrected afterwards — worth stating because the
symptom is a stack overflow at the first pause, far from the edit. (4) **The
one-owner COUNT matched its own documentation, for the third time in one
sitting** (after the `PLAYWRIGHT_BROWSERS_PATH` clause and, historically, the
`art.js` `<defs>` scan): two of `startMusic()`'s three "call sites" were the
comments explaining the rule. Every one-owner count in that test is
comment-stripped now — including the pre-existing `keepAwake()` one, which was
green only because its comment happens to write `keepAwake/letSleep` without
the parens. A count of identifiers must not be able to count sentences.

**THE INSTALL BOUND WAS RE-MEASURED A THIRD TIME AND THE DATA SAID SOMETHING
DIFFERENT — it is not drifting upward, it is BIMODAL, and the fix was to stop
tuning the constant.** Run #317 took **17m47s** and **17m39s** on the two jobs;
three hours later run #319 took **4m05s** and **44s** — the same work, against a
documented 57-second norm. So the number had moved 57s → 7m30s → 10m01s →
14m48s → 17m47s not because installs are getting slower but because the
Playwright CDN has bad days, **and no value of `PER_ATTEMPT` makes a
third-party mirror reliable — it only decides how long you wait for it.** The
structural fix is an `actions/cache` of `~/.cache/ms-playwright` inside the same
ONE owner, so the ~350MB comes from inside the datacentre; a hit leaves
`playwright install` doing only its apt `--with-deps` work, a miss downloads
exactly as before, still bounded and still retried. Four things worth keeping.
(1) **A comment that justifies a constant can be REFUTED by later data, and a
comment cannot go red** — the shipped file still read "20 min is ~35% over the
observed worst" when the observed worst had become 17m47s and the real figure
was **12%**. That is the same defect class as `deploy.yml`'s install comment
saying "45 min is a backstop" beside a `timeout-minutes: 70`, found in the same
pass. When you move a number, re-read the sentence that explains it; when you
see a worse worst case, re-read the sentence that was justified against the old
one. (Bound now 25 min, caller backstop 70 → 85 so `3 × 25 + backoff = 76` still
fits and `ATTEMPTS=3` is not a lie.) (2) **A guardrail that pins a TUNING
CONSTANT teaches the next author to edit the test instead of thinking about the
bound.** The behavioural test hard-coded `PER_ATTEMPT=1200` as a
substitution-safety check, so a pure re-tune broke a test about RETRY
BEHAVIOUR; it now READS the three constants out of the shipped script and
derives the expected HUNG count and the flaky stub's success attempt from
`ATTEMPTS`, keeping the no-op guard (`assert.notEqual(fast, script)`) that made
the pin worth having. Proven on BOTH halves: 900/1500/2400 and `ATTEMPTS=4` all
stay green, while renaming the constant or setting `ATTEMPTS=1` goes red. (3)
**Caching the wrong directory is a no-op that LOOKS like a fix and reports a
cache hit for ever** — strictly worse than no cache, because it hides the
download it was meant to remove. So the path is asserted to be Playwright's
Linux default and the action is forbidden from repointing
`PLAYWRIGHT_BROWSERS_PATH`, and the key must be derived from the lockfile or a
version bump keeps restoring the old browsers (the entry is only rewritten on a
miss). (4) **The scan matched its own documentation, again** — the
`PLAYWRIGHT_BROWSERS_PATH` clause fired on the comment explaining the rule, so
the action is comment-stripped before scanning, exactly as the `art.js`
`<defs>` scan already had to be. All four clauses mutation-proven.

**TD-19 COMFORT & SOUND** is three player-facing asks. **🎵 The soundtrack** is
now a real score rather than one tune: `DATA.MUSIC` holds it as scale DEGREES
and `TDLogic.musicStep(i, ctx)` arranges it, so each of the ten worlds has its
own key (`WORLDS[].music`), the build phase is thinned to the strong beats with
no percussion, a wave is the full march with a harmony line, and a boss forces
the minor scale plus a drone. Pure, so it is unit-tested with no audio; the
player chain (toggle → composer → `JoshAudio.tone`) is proven separately in a
browser, and it follows the RUN as well as the room: the arrangement thins for
a build phase and turns minor with a drone for a boss OR for low lives.
**🚪 The side door now warns a WAVE early** — the marker used to appear
only for waves in flight or the one already queued, i.e. after the gold was
committed — drawn as an expanding radar ping in a red-orange nothing else on the
field uses. **↩ Undo** takes back the tower you just placed at FULL price,
scoped to the build phase (and cleared by `callWave`) so a tower that has
actually shot can never be un-bought; it shares ONE `removeTower()` with `sell`
and takes the sell slot in the panel, so it costs no layout. The **post-mortem**
gained the matching line: the defeat screen reads the counter matrix, which is
the right diagnosis for every loss EXCEPT a flank — if part of the wave walked
in behind your guns, no change of tower LINE helps and the counter advice sends
you off to rebuild for the wrong reason. It is derived from the losing wave's
own groups (no engine field), additive rather than instead-of, and the guardrail
pins BOTH halves: a door-wave defeat must name it and an ordinary defeat must
not, or the line is noise on every loss.
**TD-11 MULTI-PATH EVERYWHERE** takes the TD-7 lane subsystem from 1 of 12 levels
to 3: **L3** introduces the lever deep in World 1 (so L10's train set is no longer
the first one you meet) and **L7** gets a mid-game use. The retrofit is safe
because it is a **default-noop**: lane 0 is byte-identical to each level's
original `path`, so every winnability sim — none of which pulls the lever — is
untouched, and a guardrail asserts `paths[0] === path` so that stays true. The
method matters: existing maps' pads were placed tightly around their single lane
by an earlier audit, so a fork must be SEARCHED for, not eyeballed — a scratch
generator enumerated axis-aligned detours per level and kept only those that
preserved the shared prefix, stayed in bounds, actually diverged, gained ≥20%
length, and left every pad ≥0.99 cells clear of BOTH lanes. **Only 3 of the 12
maps admit a fork at all without moving pads** (L1, L3, L7) — recorded rather
than forced, since relocating pads would re-open each level's tuning. The new
guardrail immediately paid for itself by catching a PRE-EXISTING bug: the
original pad-geometry audit only ever checked the DEFAULT lane, so **L10's pad
p10 sat 0.50 cells from its long lane** — throwing the lever ran the train
straight through a tower. Moved to (19,10). Lesson: when a level gains a second
lane, every per-lane law (pad clearance, the CALL-button overlap check, soldier
posts) must be re-run against EVERY lane, not just lane 0.
**TD-14 COMFORT** adds the two quality-of-life pieces the fort was missing: field
speed now steps **1× → 2× → 3×** (90 ticks/sec; the frame loop's 6-ticks-per-frame
cap already prevents a spiral), and **💾 Backup** on the fort home hands you the
save as text and takes it back. Backup matters because `localStorage` is the ONLY
store — a cleared browser or a private-mode session takes the whole fort with no
warning. The restore **validates before it writes** (must parse, must be an
object, must be `v === 1` with a `stars` object) so a bad paste can never destroy
a good save, then reloads so every field goes through the normal boot coercion
rather than trusting the pasted shape. NOT included, and worth naming: a 4th
world and a kid-mode fort were listed under this category and are **not built** —
both are content projects on the scale of TD-4, not comfort polish.
**WORLD 4 (the Attic, L13-L16) + 🧸 KID FORT shipped on the second attempt — the
first was REVERTED, and the revert is the lesson.** Attempt one passed my own
local sim but failed two shipped guardrails, so it was pulled rather than
shipped: never tune against a solver stronger than the one in the suite (mine
bought tier-4 branches; `PLAYABILITY`'s deliberately does not, so levels that
looked comfortable locally still failed). What finally closed it: (1) **a boss is
its own difficulty axis** — L16's margin was eaten by the Tickmaster, not by its
waves, proven because HALVING the wave budget made the margin WORSE (3 → 2
lives); 4200hp/12-lives → 3200/8 landed the finale inside the 5-17 window that
`PLAYABILITY` and `AUDIT boss tension` jointly demand. (2) **Composition beats
budget** — drawing freely from the special roster produced waves of shielded +
splash-resistant + self-healing enemies with no answer, unwinnable at EVERY base
and gold; a VANILLA backbone with at most one special shape per wave (≤25% HP)
took the world from 2/4 to 4/4. (3) **Short paths are HARDER** (less tower
exposure — the TD-4 law), so L14/L15's lanes were lengthened. (4) `night` is
untunable for a new world's mid level: −15% reach held L14 at heroic 0/3 across a
600→1500 gold sweep, so it was dropped. Two systemic changes came with the world:
the star economy now DERIVES from `DATA.LEVELS.length * 3` (a literal 36 would
fire Full Fort a whole world early — the ceiling is 48 now), and the fort-home
meta row became a wrapping GRID because a 5th button overflowed 320px (grid gap
also survives iOS 14.2, unlike flex gap). **🧸 Kid Fort is a different CONTRACT,
not another difficulty tier**: RULE 5 forbids failure states for Josh, so the
`kid` difficulty carries `noLose` — read at the ONE place a run can be lost, so
casual/normal/heroic stay genuinely losable (guardrail-tested both ways) — and a
kid run is marked `cheated` so it can never write a star or earn a badge. Inside
`body.td-kid` the kid laws switch back ON (every restyled control ≥75px,
guardrail-scanned), while the adult fort's skin is untouched.
**The abilities' first REAL-PLAY report ("it's not clear what the powers do and
some of them don't even seem to work at all") found two defects the whole test
suite had sailed past, because every test drove `useAbility` directly and never
looked at the button.** (1) **A power that changes nothing must never charge
you** — Rally Horn with no camps returned `ok`, did nothing, and still took 80
gold and started a cooldown; Toy Box Drop on empty ground took 130 for zero
hits; and both worked in the BUILD phase, where a puddle expires before the
first enemy arrives. All three read exactly like a broken button. Now
`abilityWouldDo()` runs BEFORE any gold or cooldown is spent (someone to rally /
a real tower / something inside the blast), and abilities are wave-only —
`not-in-wave` / `no-targets` / `no-soldiers` / `no-tower` are refusals, not
silent charges. (2) **The name existed only in `aria-label`** — a sighted player
saw `🧨 130` and nothing else, and the Toybox Guide (built for exactly this
problem one phase earlier) covered enemies and towers but NOT abilities. Each
ability now carries a `short` button label, the guide has a Powers section
(cost · cooldown · how to aim), and a hint line over the field says what an armed
power is waiting for ("⚡ Tap one of your towers") or why a tap was refused ("🪖
No soldiers to rally — build an Army Guys camp first"). Lesson: a feature whose
tests all call the API directly is untested as a FEATURE — drive it through the
button, and ask what the screen actually tells the player.
**A control that FLOATS over the playfield is a tap thief — and a per-tier
upgrade that doesn't change the sprite is an invisible purchase.** Two user
reports, one root cause each. (1) "The summon next wave yellow button is now
placed poorly behind the power up buttons": CALL (z-index 6) and the TD-9 power
strip (z-index 7) both floated bottom-left, so the strip sat ON the button. The
first fix — make them mutually exclusive in time (powers are wave-only, CALL is
build-only) — was right but incomplete, because generalising the shipped
"no pad hides under CALL" audit from CALL to EVERY floating control immediately
found **8 more maps with a pad buried under the power strip** (building is legal
mid-wave, so that tap is genuinely eaten). A search over 24 anchor × layout
combinations proved **no floating position buries zero pads** — pads hug the
lanes across the whole board — so the strip left the battlefield entirely: it is
now a real layout ROW under the field in portrait (which is WIDTH-limited, so
~150px below the canvas was dead space and the field does not shrink at all) and
an absolutely-positioned COLUMN in the landscape side gutter (landscape is
HEIGHT-limited but the 24×14 board leaves wide gutters). `resize()` now
subtracts any IN-FLOW sibling below the field generically (an absolutely
positioned one costs nothing), so a future in-flow control is accounted for
instead of silently pushing the page taller. During build the strip goes INERT
(dimmed + `pointer-events: none`) rather than hidden, so the field never resizes
at a phase boundary — and a power armed mid-wave is disarmed when the wave ends
(the stale-rally-arm class). Kid Fort is the one documented exception: its ≥75px
buttons were a 172×180 block that would have eaten a third of the field, so it
kept floating — safe only because that difficulty was `noLose` (the mode is
retired now, so the exception is gone with it). The audit is now
three laws: nothing may bury a pad or the lever during BUILD (a pad buried there
is permanently unbuildable), the lever must be clear mid-wave too, and a fenced
count for the residual. (2) "I want towers to look visibly different each level
up they get": only the Dart changed at all (barrel count); mortar, fan and camp
drew the IDENTICAL sprite at tiers 1-3, and a 300-gold tier-4 branch looked
exactly like the tier-3 it replaced. Each line now grows along its own axis
(barrels → tube length + iron bands → blade count + guard cage → camp size +
lookout), gains a plinth at T2 and a bolted skirt at T3, and all six branches are
their own silhouette (sniper bipod, spinning minigun, Bertha's muzzle brake,
dripping honey pot, six-blade blizzard, a purple tesla coil, a scaled dino ridge,
an RC pit lane with a checkered flag), with a crown replacing the fourth pip. The
guardrail is generic and pixel-based: it renders each variant alone, hashes the
canvas around it, and fails if any tier matches the tier below or either branch
matches tier 3 or its sibling — so a future tower line cannot ship without tier
art. The same audit caught the squad: **every soldier drew as the same tier-1
grunt**, so ranking a camp up — and especially taking Dino Squad or RC Racers —
changed nothing on the field. Army guys now darken and gain a flak vest, a
longer rifle and rank chevrons with tier, Dino Squad fields a spined little
dinosaur and RC Racers a tiny antenna'd car, guardrailed by the same hash.
**The World-4 + Kid-Fort adversarial pass found FOUR shipped defects, and every
one of them was invisible to a green suite because the suite never LOOKED.** They
sort into two kinds. *Content that exists but cannot be reached:* the fort home's
level grid was `TOTAL_PLANNED = 12`, a literal left over from when World 4 was
still a plan — so when the attic actually shipped, **L13-L16 and the Tickmaster
had no card at all and were unreachable by the player**, the exact mirror of the
documented "a level-select that shows locked slots must actually HAVE levels
behind them". Worse, two existing tests asserted `12 level cards` / `11 locked`,
so the suite was *pinning* the bug; both now derive from `DATA.LEVELS.length`,
like the star ceiling. *Art that silently falls through:* the enemy draw is a long
if/else ending in a default Sock Goblin, and two shipped enemies never got a
branch — the Tin Plane, and **the Tickmaster, the entire World-4 finale, which
marched in as a 3200hp sock**. Both now have real art (a riveted banking tin
aeroplane; a crowned wind-up alarm clock whose hands spin faster as its hp-gated
phases escalate, so the phase is readable on the boss itself), and a generic
pixel-hash guardrail fails if any two enemy types render identically — which is
precisely how a missing branch shows up. The other two were engine/UI edges:
`resize()` measured a HIDDEN screen as 0 wide and `Math.max(10, …)` rebuilt the
whole battlefield at its minimum cell, leaving a collapsed field until something
resized again (now it keeps the last good size); and `JonTD.route()` only ever
un-hid its destination, so the callers that invoke it DIRECTLY (the reset button,
the resume-dismiss, the leave hook) could leave BOTH fort screens in flow — the
play screen stacked under a ~900px home, which pushed the field's top past the
viewport and triggered exactly that collapse. Coverage added to match: the
Tickmaster's phases are now FORCED band-by-band (a solver kills it straight
through, so the whole kit could have been dead code — the Static precedent), the
kid `noLose` gate is proven to hold for kid AND to leave casual/normal/heroic
genuinely losable, the 🧸 button is actually pressed in a browser (kid skin on,
run marked cheated, every visible control ≥75px, a fully-leaked wave that never
loses), and an attic level is opened, tapped and built in a real browser. Every
new guardrail was mutation-checked — each one was proven to FAIL on the pre-fix
code before being kept. A follow-up **one-pass overlay auditor** (every fort
dialog × 320/390/844 viewports, reporting ALL violations at once) then caught a
fifth, and a nastier one: **`.td-overlay` was `position: absolute`, so the scrim
centred its dialog in the HOST SCREEN rather than the viewport** — and the fort
home is as tall as its level grid. Making World 4 reachable took that grid from
12 cards to 16 (~1250px), which pushed EVERY fort-home dialog (star tree, badges,
endless, guide, backup, reset gate) hundreds of pixels below the fold: you tapped
⭐ Star Tree and nothing appeared. Fixed with `position: fixed` + longhand offsets
(never the `inset:` shorthand — Safari 14 drops it and the box shrink-wraps, the
documented iOS-14.2 modal law), and locked by promoting that auditor into the
suite. Note the shape of it: adding CONTENT broke a LAYOUT assumption three files
away, and only a viewport-relative measurement could see it. Meta-lesson: a
feature that only ever ran through node sims is untested as a FEATURE; press its
button, look at its screen, derive every count from the data instead of writing
the number you happen to ship with — and after adding content, re-measure the
screens that content makes taller.

**TD-15 gave the player a THIRD lever — sending waves — and made a boss leak
hurt.** (1) **Overlapping waves.** CALL was build-phase only; it now works
mid-wave too, as ⏩ RUSH, dropping the next wave on top of the one already
walking for the same early-call gold. The implementation is one idea: split the
single `waveIdx` into **`waveIdx` (cleared) and `sentIdx` (sent)**. They are
equal at every build boundary — which is why a mid-run checkpoint needed no new
field, one saved number restores both — and diverge only while an overlap is in
flight. `scheduleWave` now APPENDS to the spawn queue instead of replacing it,
which is a default-noop (at a normal wave start the queue is empty, so every
historical stream stays byte-identical and the determinism suite is the proof),
and `finishIfWaveDone` sets `waveIdx = sentIdx` so BOTH cleared waves count and
the run never replays one. Two design guards, each guardrail-locked: a cap of
`RULES.maxWavesInFlight` (2) so a player can't dump a boss finale onto wave 1,
and `RULES.rushSettle` (2s) so a **fumbled double-tap can't rush** — the button
relabels itself from ▶ CALL to ⏩ RUSH the instant the wave starts, and without
the settle window the second tap of a doubled press would send a wave you had
not seen yet. That one was caught by the existing toddler-chaos guardrail going
red, which is exactly what it is for. (2) **Bosses are consequential.** The leak
toll was already a data field (`lives`) read at the ONE leak site, so making a
boss cost more was a data change (5-8 → 6-10 against a 20-sticker door) — every
playability sim still passes untouched, which is the whole point of keeping the
toll in data. What was missing was that you could not SEE it: the toll now rides
the leak event, so a boss leak flashes deeper and longer than a sock's, shakes
the field, and floats a `−8 ❤` at the door, and the Toybox Guide gives any
multi-life enemy a "costs N stickers" trait line automatically. Size became a
data field too (`size`, read by one `bossScale()` helper) rather than four
hand-tuned constants in the renderer, so a boss is big by declaring it.
Two follow-ups worth recording: moving the strip in-flow bought a
clean field but risked the opposite bug — field + strip + topbar taller than the
viewport, so the PAGE scrolls and the battlefield shifts under your thumb on iOS;
measured clean at 18 size × mode combinations and now guardrailed. And the
concurrency cap is genuinely ONE number: setting `maxWavesInFlight` to 4 really
does stack four waves (3 → 8 → 16 → 27 enemies alive, the fifth refused), so
raising it is a data change, not a project.
**The wake lock had the classic half-a-feature bug, found by being asked "did you
prevent screen sleep too?" and actually reading it.** It was acquired in
`startLevel` and released only in `stopLoop`, which fires on win/defeat/restart —
so **pausing, or quitting to the fort mid-run, left the screen pinned awake
indefinitely** while you browsed the star tree (the rAF loop keeps running when
`cur.paused`; nothing released it). The tell was that the code disagreed with
itself: the `visibilitychange` handler already tested `!cur.paused` before
re-acquiring, so one path believed a paused battle shouldn't hold the lock and
the other never enforced it. Fixed the RULE-7 way — ONE predicate
(`wakeWanted()`: a battle exists, is visible, is unpaused, and hasn't ended) and
ONE owner (`syncWake()`), called from every site that can flip those conditions
(start, pause, resume, route to/from the fort, visibilitychange). `keepAwake`
also gained a `wakePending` flag, because `request()` is async and the player can
pause while it is in flight — the resolved sentinel is released immediately if
the conditions changed. Guardrails: a `site.test.js` structural check that
`keepAwake()` is reachable from exactly ONE place, and a browser test that stubs
`navigator.wakeLock` with a spy and drives start → pause → resume → quit → win,
asserting the held count at each step (both halves mutation-proven). Lesson: a
HELD resource needs one predicate and one owner, or the acquire and release paths
drift apart — and the drift hides in the states nobody drives.
(3) **Haptics on iOS: still no, and
the PWA does not change it.** Adding the site
to the home screen changes the CHROME (no URL bar, its own switcher card), not
the API surface — standalone mode runs the same WebKit, and WebKit on iOS has
never implemented the Vibration API. The shipped feature-checked path stays as
it is: real on Android, an honest no-op on Josh's iPad. Do not add an iOS
haptics "trick"; the only real path is native.
**The follow-up audit round found that several shipped guardrails were checking
the wrong SCOPE, and that is the theme tying every one of its findings together.**
(1) **The fort has TWO coordinate spaces one `+ 0.5` apart** — the engine stores
CELL INDICES (path points, pads, soldier posts, puddles) and the canvas paints at
the cell's MIDDLE — so anything that forgets the shift lands 0.707 cells up-left
of what it belongs to. Four places had: a point ability was handed the tap in
world units while the engine measured in cell-index space (an enemy visibly
inside the amber Sticky Floor was NOT slowed), the rally flag's `- 0.5` cancelled
`glyph()`'s own centring, the puddle painted at raw engine coords so the drawn
circle and the slow zone were different circles, and the squad drew off its lane.
Invisible to every "does it win?" test, because the engine was right and only the
PICTURE was wrong — so the guardrail measures actual INK against actual state
(frame-diff the squad, round-trip a tap to the puddle within 2px, compare the
flag's ink to both candidate anchors), all mutation-proven at the predicted 18px.
Writing it surfaced a fifth: **`glyph()` never set `fillStyle`, so a monochrome
emoji fallback inherited whatever colour the previous draw call left behind.**
(2) **A viewport list IS the test.** The "no pad hides under a floating control"
audit ran at 390×844 and 844×390 — the only two sizes where the floating CALL
button happens to miss everything. One size down it buried pads DURING BUILD,
which makes them permanently unbuildable: 3 at 375×667, 10 at 360×640, 12 at
320×568, **36 and a LEVER at 320×480**, 14 at 667×375. Every control now lives in
one off-field block (a row beside the powers when the phone is ≥360px wide, so
the field is unchanged at every size Jon plays; a column in a RESERVED landscape
gutter — reserved, not assumed, or a wide window grows the field straight under
it), the audit runs eight viewports, and its old "budget 12 buried mid-wave"
fence is gone because the honest number is now 0. Corollary: a control that is
IN the layout must never hide, or the field resizes under the player's thumb —
CALL goes INERT and says why ("steady…", "2 waves out", "last wave").
(3) **A stylesheet-scoped guardrail only guards that stylesheet.** The
flex-gap law (Safari 14.0 DROPS `gap` in flex) was enforced against `main.css`
only, so all 16 of `td.css`'s flex+gap rules shipped unaudited and on the real
iPad the top bar, the tower panel, the difficulty chips and every dialog's
button row sat flush together. Also: a bare `gap` on a selector that INHERITS
`display:flex` is the same bug with no `display` to spot it (`.td-bar--play`
added 8px on a modern browser and nothing on iOS).
(4) **A checkpoint must hold what you are LEAVING, not the last wave boundary.**
The build countdown was never saved, so every resume handed back a full build
phase — and the early-call bonus is computed from it, so quitting with a second
left turned "gold traded for build time" into free gold, once per wave, forever;
towers bought during the quit-from phase were silently lost; the run tallies were
not carried, so a resumed run reported only its post-resume damage as the whole
run; and a malformed `midRun` from a restored backup threw `mr.towers is not
iterable` and killed the resume outright. **Testing footgun worth knowing:**
`__TD.script()` calls `phaseWatch("(scripted)")` after every batch, so it writes
a checkpoint the real rAF loop would not — a test that scripts and then inspects
a checkpoint is testing the harness unless it splits the batches.
(5) **Two shipped stat lines were lying.** Damage-by-line credited the SWING, not
the work (a 300-damage Toy Box Drop on a 6hp sock scored 300 — the dart read 76%
of a run against 58% real), and the Fan's beam accumulates 6-14 dps into ONE
point of damage per firing while `computeHit` and `dealDamage` both round, so
brittle (+20%) and Boss Bonker (+15%) rounded 1 straight back to 1 and did
literally nothing on a Fan. Multipliers now scale the accumulator, with
`dealDamage(..., preScaled)` so they are not applied twice.
(6) **Endless: the Attic had a pool, no arena, no row, and a campaign boss.**
`endlessLevelDef` fell back to `arenas.bedroom`; the picker named three worlds by
hand (the "grid says 12" literal again — rows derive from the data now); and its
every-5th-wave mini-boss was the **Tickmaster**, the 3200hp/10-life World-4 boss,
against the 400hp Piñata everywhere else, so the run ended at wave 5-9 against
28-46 elsewhere under EVERY build. Measured negative result: the all-specials
pool was not the problem — adding a vanilla backbone or dropping the Slime, the
Screw or the Cushion each moved it by one wave; only the mini-boss mattered.
(7) **⏩ RUSH clears two waves at one boundary**, so the single payout paid the
💵 Allowance once for two waves and could step straight over a 🩹 Patch Kit heal
(waveIdx 4 → 6 never sees `% 5 === 0`). Payouts iterate the waves actually
cleared — exactly once without a rush, so every historical run is byte-identical.
(8) Smaller, same shape: **`stableStringify` flattened NaN/±Infinity to "null"**
(JSON does), so the determinism hash — this engine's entire test strategy — was
blind to exactly the corruption it exists to catch; **a boss draws at its `size`
scale, so an hp bar pinned 0.6 cells above the centre painted INSIDE the body of
every boss**; `close` targeting was a selectable mode no test ever drove; and a
boss's size and a multi-life leak's heavier flash were data fields no render test
read. **Recorded, not forced — and later MEASURED and FIXED, see the rally entry
at the end of this block:** `defaultRally()` measures a path point (cell index)
against the pad's WORLD centre, disagreeing with `rally()`'s own range check.
This was written off as cosmetic on numbers taken from a one-level sample ("moves
237 of 247 pads … soldier posts off a lane from 1 to 4"); swept over all 40
levels it was 22 of 501 pads posting a soldier where it can never block and 16
camps opening on a flag `rally()` refuses. The deferral was wrong because the
measurement behind it was scoped to L1. Finally, **the live-verify guard had the same
scope bug as everything else**: it polled only `index.html` for `?v=<sha>`, so a
CDN edge serving the new HTML with a not-yet-propagated `art.js` failed two
tests on a commit that touched neither — it now requires every versioned asset
to return 200 from that edge first.
**Three more from the same round, same shape.** (1) **A seed set can hide a
broken contract**: "every level winnable on heroic" is shipped truth, and L7 —
the air-pressure level, already documented as sitting at its heroic ceiling —
LOST on 3 of 12 seeds under the same best-of-two oracle `PLAYABILITY` uses,
winning the rest with 1-6 lives. A level that is unwinnable a quarter of the
time is not hard, it is a coin flip. `startGold` 450→490, chosen by sweep (450
→ 1 loss, avg 2.6; 490 → 0 losses, avg 6.3; 530 → avg 12.3, a stroll); normal
barely moves (19.3 → 20.0, it was already a formality there) and neglect still
loses on all three difficulties. (2) **`kid` is a per-RUN mode, not a saved
chip** — the 🧸 button passes it to `startLevel` and the home only ever offers
casual/normal/heroic, but it IS a real difficulty, so a restored backup
carrying `difficulty:"kid"` passed the boot coercion and stuck: every level off
the grid became an unlosable run that could never score a star, with no control
to switch back. (3) **"Gold earned" counted bounties only** — the early-call
bonus (60-135 a wave, paid again on a RUSH) and the 💵 Allowance are real
income, so the summary understated a third of what a call-early run made. That
is now three lying stat lines found in one pass (overkill damage, the Fan's
rounded-away multipliers, and this): whenever a number is SHOWN to the player,
find every site that should feed it, not just the obvious one.
**Optimizing fully for portrait (the owner's directive) paid immediately, and
the win came from two DIFFERENT causes because the board is WIDTH-limited on a
modern phone and HEIGHT-limited on a small one.** The screen's 12px side padding
was taxing the battlefield (it belongs to text and dialogs, not the field), and
the control block fell to two rows below 360px. Fixing both, measured in canvas
pixels: 414×896 gained 15%, 390×844 8%, and a 320-wide phone — where every
control pixel comes straight out of the field — gained **71-96%**. Three
implementation notes worth keeping: (1) **negative margins do NOT widen a box
that has `width: 100%`** — they only shift it, so the first attempt gained
exactly nothing and looked like the CSS wasn't applying; `width: auto` is what
lets the box grow. (2) **Fit a control row BY CONSTRUCTION, not by breakpoint** —
the breakpoint version had a cliff at exactly 360px where the full-size row was
4px too wide and spilled off both edges; a `minmax(76px, 92px) minmax(0, 1fr)`
grid with per-tile min/max clamps cannot have a cliff. (3) **A size declared
twice has no owner** — `.td-abil` was set to 52px in its base rule and again,
unscoped, 250 lines below at 60px, so every media-query override (portrait AND
landscape) was a dead letter and the tiles were 60px everywhere. When an
override "isn't applying", grep for a second declaration before doubting
specificity. A sibling trap from the same pass: **overriding `grid-auto-flow`
without also overriding `grid-template-columns` does nothing** — portrait gives
the control block two explicit tracks, so Kid Fort's `grid-auto-flow: row` filled
them ACROSS and produced the 272px bar its own comment said it wasn't.

**The post-portrait audit (every fort surface screenshotted, every world re-simmed)
found two more, and one honest negative.** (1) **A picture emoji whose DEFAULT
presentation is TEXT renders as a thin monochrome glyph** — nine shipped that
way: the Plastic Knight's 🛡, the Bed Monster's 🛏 (also the bedroom's spawn
marker painted ON the battlefield), the Couch Cushion's 🛋, the Vacuum King's
🌪, the Attic's 🕯 (a bare sliver), the HUD's ❤, the Fan's ❄, the run summary's
🏗 and the boss klaxon's ⚠ — while the SAME heart and shield were written
correctly (❤️ 🛡️) a few lines away, which is what marks it as an accident. All
now carry U+FE0F (the Attic took 🧳 instead — a candle is thin even in colour),
and a generic `site.test.js` scan fails on any text-default emoji without VS16,
with an explicit allowlist for the six control glyphs (▶ ⏸ ↩ ↔ ⬆ ⏱) that are
deliberately monochrome on a coloured button. Same family as the ≤13.0 scan:
how a glyph actually RENDERS is part of correctness. (2) **The boss-tension
guardrail judged one seed**, and on that seed L16 passed — while the game's LAST
boss finished FLAWLESS at 20/20 on 2 of 8 seeds. The diagnosis is sharper than
the symptom: **waves 1-14 of L16 leak nothing at all, on any seed or build**, so
the whole level is decided by whether the Tickmaster dies in the last few cells.
It now judges the MEDIAN across 8 seeds (one lucky seed can't excuse a formality,
one unlucky seed can't condemn a fair fight), and the Tickmaster's leak toll came
down 10 → 8, in line with the other two big bosses: ten lives out of twenty
QUANTIZED the finale so it could only end at 20, 10 or dead. (3) **The negative
result: the boss's hp cannot grade that finale.** Swept 3200→3500, the mixed
board goes 6-20 → 3-19 → 3-8 → and at 3400 it LOSES outright on a seed. That is
the documented threshold-domination of this engine showing up on the last level —
a board holds a wave completely or collapses — so no hp value buys a graded
ending, and the honest deliverable was the toll fix plus a guardrail that can see
the problem, not a re-tune the data refuses to support.

**WORLD 5 (the Garage, L17-L20) shipped — and its headline is a MEASUREMENT, not
a feature: in this engine, normal difficulty and heroic winnability are separated
by a STEP, not a slope.** Roughly 180 configurations were simulated with the
shipped best-of-two oracle (never a stronger local solver — the World-4 revert),
sweeping start-gold, budget base, pad count, wave count, lane shape, conveyor
strength, boss hp, boss leak toll, flier share and bypass shapes. Every setting
where heroic was robustly winnable finished normal at 18-20 lives; every setting
that bit on normal (≤15) made heroic unwinnable on every seed. There is no middle.
That is the threshold domination already documented ("a board holds a wave
completely or collapses"), now quantified on a fresh world — so the Garage ships
per its plan's own exit as a firm world that is **not harder than World 3 on
normal**, whose real test is its finale: **the Toolbox Titan finishes at a median
9/20 across 8 seeds (range 7-11, no seed lost), against L16's median 16 — the
tensest ending in the game.** Four negative results are worth as much as the
world itself, because each closes a lever a future author would otherwise retry:
(1) **a BYPASS shape does not produce chip damage** — making the tunnelling mole
(untargetable AND unblockable through the middle third) a recurring late special
moved normal by exactly ZERO lives on both probed levels, because a full board
still kills it at the ends; (2) **air pressure is map-specific** — at 1.8× the
flier share L18 dropped to a median 16 on normal and lost on every heroic seed,
while L19 did not move at all, so the lever that fixed mortar-mono does not
generalise; (3) **a conveyor is the `night` class of knob** — at ×1.45 over three
strips L17 held normal comfortably and was heroic-unwinnable on every seed, so it
ships at ×1.30 and is guardrail-capped at 1.35 (L7 is the one conscious
exemption, and the list is asserted not to be the whole population); (4) **boss hp
above ~5800 QUANTIZES a finale** — every seed lands on exactly one boss leak (12
or 14 lives), the flat ending the Tickmaster's 10-of-20 toll produced, so 4600hp
with a 6-life toll is the only band that is both graded and safe. The plan's
"L20 must lose ≥3 lives before its boss wave" was **not achieved and is recorded
as such** — waves 1-14 leak nothing on any tested seed or build, the same shape
as L16, and it is not fixable inside the budget contract for the reason above.
Five build lessons generalised beyond this world: **a wave count is a difficulty
knob, because each wave is 1.18× the last** (16 waves put the last one beyond any
board — the world runs 14-15); **a forked level's pads must be searched against
the DEFAULT lane** (the first cut spread L19's over both, so a third of the board
only covered the loop nobody was walking, and it lost 11 lives in one wave — the
lever's payoff is the tail towers getting longer on target, exactly as L10's is);
**lane rows must sit farther apart than a tower's reach** (L18's first cut ran
four rows 3-4 cells apart against a ~4-cell tier-3 dart, so ONE tower covered two
runs and the level was flawless at 10 pads on heroic; rows are 6 apart now);
**a spawner needs a capped LOAD, not a fountain** (uncapped, ten Bolt Buckets on
a late wave outlived their own HP by ~7× and dropped ~18k of free HP onto an 11k
wave, wiping a board flawless for fifteen waves — and the wave-budget audit sums
`def.hp × count` and cannot see a single spawned child, so the enemy itself has
to be finite for that number to mean anything); and **an even wave's primary
backbone slot decides how many BODIES a wave has** (marbles are 16hp at speed
1.7, so leading with them made an even wave a 200-strong sprint that outran every
board — the beefy slow Blob leads, marbles garnish). Two shipped defects fell out
of the build, both the documented "wrong scope" shape: the renderer's spawn-marker
if/else chain silently fell through to the bedroom's 🛏️ for the whole attic (it
is a `DATA.WORLDS[world].spawnGlyph` field now, so a world cannot ship without
one), and **the TD-11 fork test measured a pad's WORLD CENTRE against a RAW lane**
— +0.5 on one side only, biasing every distance by up to a half-cell diagonal.
It rejected correctly-placed pads that its own sibling `AUDIT pad geometry` (which
adds +0.5 to both, so the offsets cancel) passed. The engine is the tiebreaker: a
tower stores `cx: pad.cx` and targets against `posAt`'s cell indices, so index
space is the truth. The "two coordinate spaces one +0.5 apart" trap, this time
inside a test. Finally, the counting law claimed two more literals: the structure
test's "16 levels"/four-name world list and the badge count now DERIVE (worlds of
four, a boss per finale, one badge per boss + 9 cross-cutting), the fort-home
blurb derives its "20 levels across 5 worlds … 5 bosses", the endless lock hint
counts its world's actual levels, and the "newest world opens and plays" browser
test is pinned to the LAST world in the data rather than naming one that stops
being new.

**WORLD 6 (Moving Day, L21-L24) shipped, and it reproduced the step function a
THIRD time — this time in seven measurements on one level.** L23 was designed to
finish around 17 and refused on every lever: at a 41-cell lane it finished normal
14 but lost heroic on 3 of 4 seeds, and gold could not buy it out (1300 → 1450 →
1600 moved normal not at all and still lost 2 seeds); lengthening the lane to 52
fixed heroic (9,15,17,9 — no losses) and pinned normal at **20**, where it stayed
through 58; raising budgetBase 700 → 800 → 880 swung heroic from comfortable to
losing 3 seeds while normal *never moved off 20*. So the boundary World 5
measured across ~180 configurations is not a property of that world's maps: in
this engine **normal difficulty and heroic winnability are separated by a step,
not a slope**, and a level that lands on the wrong side of it cannot be nudged.
L23 ships where every gate passes and the ~17 target is recorded as unreachable
rather than faked. The finale is where the tension lives, and it landed: **The
Moving Van finishes at a median 14/20 across 8 seeds (range 12-14, no losses)**.
Two enemies close the counter matrix: **🧻 Bubble Wrap** (`bonkResist`) is the
Couch Cushion's exact mirror — bonk (dart, soldier melee) lands at 40% while
splash, zap and abilities cut through — and it is the first enemy that directly
answers the **Dart**, the generalist CLAUDE.md records as clearing 16/16 on
normal; a guardrail asserts the two are opposites (neither may carry the other's
resist, or nothing would answer it). **📻 Boom Box** (`hurry`) is a threat damage
does not answer: it makes the wave ARRIVE FASTER, via a write pass (the Junk
Healer's shape) and ONE read in `effSpeed`, already the single place a speed is
decided — so zones, enrage, boss phases and the music compose instead of each
growing their own speed computation. The boss's whole kit is paths the engine
already ran (the Bolt Bucket's capped `spawner`, on a boss for the first time —
a van that unloads as it drives — plus `disable`/`spawn` phases). Two process
notes: the guardrail needed the ONE damage path, so `dealDamage` is now exposed
on the engine exactly as `isHidden` is — proving a resistance is keyed on the
right `how` beats inferring it from a time-to-kill with confounds; and the apply
script appended level objects HIGH-TO-LOW, leaving ids `…20,24,23,22,21`, which
the contiguity assertion caught instantly. **Warning for a seventh world:** the
star ceiling derives as `LEVELS.length × 3` and is now 72 against a 77⭐ tree —
at 28 levels it becomes 84 and the "the tree must cost more than you can earn"
guardrail fails. The tree has to grow with the campaign. (It did: Worlds 7-8
shipped alongside a 105⭐ / 30-node tree against a 96⭐ ceiling.)

**TD-16 (level gimmicks) took gimmick coverage from 3 of 20 levels to 14, and
its lessons are about how much a mechanic is WORTH — measured, not assumed.**
Three new shapes, each a data field read at ONE place: 🕳️ **Mud Patch** is the
conveyor's own `zones[].mult` mirrored below 1.0 (**zero new engine code** — the
speed zone never cared which side of 1 the multiplier sat on), ⚡ **Power Pad**
is a `pads[].boost` that folds its fire-rate half into the existing `boostOf(t)`
and its range half into a new `reachOf(t, r)`, and 🚪 **Side Door** is a
`groups[].at` carried through the spawn queue into the `dist` argument
`spawnEnemy` already took. Findings: (1) **zones must never OVERLAP** — the zone
loop `break`s on the first match, so where two overlap the ARRAY ORDER silently
decides which multiplier applies; L7's first mud placement (16-22) overlapped its
conveyor (20-25), cancelled two cells of the strip, and moved heroic from 8 to 18
lives with nothing else changed → a guardrail now asserts every level's zone
table is disjoint, and the strength bound became TWO-SIDED (`0.6 ≤ mult ≤ 1.35`,
because a strong slow is as much a free win as a strong conveyor is a free loss).
(2) **A slow zone disproportionately rewards a DART SWARM** — L5's mud flipped
the shipped "no single plan clears heroic" property (dart-only went from losing
L5 to winning with 12-14 lives) while the side door alone left it exactly
intact, because more time in range compounds across many small guns. The mud
came back off L5 rather than re-pointing the guardrail at a different level —
when a change breaks a property test, the change is usually what is wrong.
(3) **The same mechanic can be a rounding error on one map and a re-tune on
another**: a side door was worth −1 life on L2 and −5 on L13, scaling with lane
length and pad count, so it has to be dosed per level by measurement. (4) **A
range buff must reach all FIVE range reads** (dart acquire, dart sticky-KEEP,
mortar, fan aura, fan zap) — the "grep every place a target is chosen OR kept"
discipline, applied to distance. And the testing lesson, which is the old one
again: the first Power Pad guardrail passed a `{range, rate}` boost to BOTH
halves of its assertion, and a range buff by itself raises the shot count (the
tower acquires sooner and holds longer) — so **the "fires faster" half could not
fail**, and a mutation removing the rate buff entirely stayed green. Rate is now
measured against a target PINNED beside the tower, where range cannot influence
the count. A test that cannot fail is worse than no test, and the way to find
out is to mutate the thing it claims to check. One deliberate exception is on
the record: **L13 moved −5 normal, outside this phase's own ±2 design rule, and
was kept** because it was the only level in the game finishing 20/20/20/20 on
normal — a formality — and it loses none of 12 heroic seeds at its new margin.
L11 was the counter-case and was NOT kept (it was already a real level, so a
door there was drift); it was softened to a single late wave.

**A post-World-5 spot check found the VS16 emoji guardrail had the same wrong
SCOPE its own docs warn about — a hand-written file list.** The scan's `files`
array named nine sources and simply omitted `scripts/td-logic.js`, where the
Toybox Guide's trait lines live, so the Plastic Knight's 🛡 and the Couch
Cushion's 🛋 were re-introduced there without U+FE0F and shipped past a green
run — the same two glyphs the original audit had already fixed elsewhere. It now
derives from the same `SCRIPTS` list the ≤13.0 scan uses (`["index.html",
...SCRIPTS]`), so a new script file is covered the moment it is added. **A scan's
FILE LIST is part of the scan** — this is the third instance of the class (the
flex-gap law guarded only `main.css`; the live-verify guard probed only
`index.html`), and the fix is always to derive the list rather than maintain it.

**The difficulty curve peaks at World 3, and that is ACCEPTED (owner, 2026-07) —
do not "fix" it.** Measured with the shipped best-of-plans solver, average lives
on normal: bedroom 15.5 dart / 15.8 mixed, backyard 17.1 / 15.0, **toystore 9.8 /
12.8**, attic 13.0 / 15.5. So World 3 is the hardest world under BOTH builds and
World 4 relaxes slightly — every attic level is winnable, losable and star-able,
the finale has a seed-robust guardrail, so nothing is broken; the curve simply
peaks one world early. It was raised with the owner and explicitly accepted. If a
future audit re-measures this and wants to act, the ONLY lever this engine
responds to is THREAT SHAPE (an hp-preserving swap in the attic's late waves) —
bigger hp piles are proven not to work, and that is a deliberate content pass to
be commissioned, not a defect to fix on sight.

**A "discard" that leaves the discarded thing ALIVE does not hold — reported from
real play as "I couldn't dismiss the resume button".** The Resume banner's ✕ ran
`clearMidRun(); route("td-home")`, and `route("td-home")` opens with
`leavingPlay()` → `writeMidRun()`, which re-checkpoints a run that is still live
and parked in its BUILD phase — so the erase was undone inside the same call and
the banner came straight back. It read as *intermittent* for the reason that
identifies the class: quitting mid-WAVE writes no checkpoint, so the ✕ appeared to
work in exactly the case where there was nothing to discard. "There is no saved
run" and "a live run is about to check-point itself" are contradictory states, so
the fix is ONE owner (`discardRun` = `abandonRun` + `clearMidRun`) that stops the
loop and drops `cur` as well as erasing the checkpoint — and `resetProgress`'s own
copy of `stopLoop(); cur = null;` now goes through the same `abandonRun()`, since
two copies of a teardown is precisely how the wake lock's acquire and release
paths drifted apart. The guardrail is the state nobody was driving: leave a
build-phase run, press ✕, then **re-route to the fort and assert it did not come
back** (mutation-proven — it fails on the pre-fix code). Lesson: when an undo
looks flaky, check whether something downstream in the same call re-creates what
you just deleted, and prefer one teardown owner over a clear at each call site.

**Every gimmick on every level was driven headless and read off the engine's own
numbers — all 17 placements behave as specified.** The audit measured, per level:
mud slows (L1 566 vs 491 ticks; L7 1135 vs 1059), conveyors speed up (L7 418 vs
488), each side door enters at its marker skipping ~half the lane, all four levers
coincide before the fork / diverge after / are ≥1.15× longer / actually reroute
enemies already walking (lanes `000 → 111`), night dims reach ×0.85, and every
power pad out-shoots or matches a median plain pad. Two methodology traps are
worth more than the result, because both produced a FALSE fail first: (1) a
control that removes ALL zones to measure one mud patch is measuring the
CONVEYORS too — hold every other zone constant and vary only the one under test;
(2) a fixed tick window is not a control when the thing under test sits at a
different point on the lane — L22's socket is 92% along a 64-cell lane, so a
1500-tick sample showed "0 shots" for a pad that is simply reached late. Run a
whole wave instead. That second one is also the audit's one honest caveat: socket
placement ranges from 18% of the lane (L9) to 92% (L22), and while L22 passes its
gate (33 shots vs a median plain pad's 25), it is the weakest of the five and is a
placement judgment, not a defect.

**The fork sweep is CLOSED, and the reason it stayed open for two whole worlds is
the lesson: an open item nothing can FAIL is a wish, not a task.** CLAUDE.md
carried "re-run the generator over the maps authored since TD-11" across two
releases, and it was unactionable because the generator was a scratch script that
had been thrown away — so the attic and Moving Day both shipped with no lever at
all and nothing went red. Re-running it (now `tools/td-fork-search.js`, in the
repo beside td-sim/td-map-search for exactly this reason) found **18 of the 20
un-forked maps admit a fork with no pad moved** — the TD-11 finding of "only 3 of
12" was a property of those early maps' tightly-packed pads, not a general limit.
Scope was chosen by RHYTHM rather than by taking all 18: a lever is a set piece,
so exactly one per world (**L15** the attic, **L23** Moving Day, joining L3/L7/
L10/L19), locked by a guardrail that derives the world list from the data and
fails if any world lacks one — or carries two. Three things worth keeping: (1) a
fork retrofit is safe *because* it is a **default-noop** — lane 0 stays
byte-identical, so both levels re-simmed to their exact pre-change numbers
(L15 19,18,19,19; L23 20,20,20,20) and needed no re-tune; (2) **pick the fork by
MEASURING the lever, not by max length** — L23's late tail loop was the longest
candidate (1.46×) but a thin build lost on both routes, while the shorter early
loop (1.42×) turns a 7-, 8- OR 9-pad build from losing on all 4 seeds to winning
on all 4, which is what the shipped `TD7 lever advantage` guardrail actually
means by value; and L23 is the level PLAN_WORLD_6 §9.1 records as pinned at 20/20
and unmovable by any difficulty knob, so a DECISION was the only thing left to
give it; (3) a candidate generator needs SHAPE rules, not just legality — the
first cut happily emitted 1-cell hairpins whose return leg lay exactly on the
default lane's final segment, because the clearance check compared the two lanes
at equal DISTANCE, which stops corresponding the moment they diverge. Compare the
detour's own legs against the default polyline instead. **Two negative results
recorded rather than acted on:** L22's power socket sits 92% along its lane (the
others run 18-69%), and it is *right where it is* — moving it to a mid-lane pad
either changes nothing (p8 48%, p10 55%) or makes the level clearly easier
(p1 64%: heroic 12→19), and it already out-shoots a median plain pad, so the 92%
is a descriptive statistic, not a defect. And a TESTING trap that cost an hour
and looked exactly like a shipped bug: `render.leverInfo()` reports the **last
draw**, so probing it after a `waitForTimeout` reads a STALE frame — it showed
lane 0 still lit on all six fork levels including L10, whose readability fix is
shipped and tested. The suite's own test calls `r.draw(0)` immediately before
reading, and doing the same showed every level correct. When a hook reports
"what happened last", you must MAKE it happen before you read it.

**A gimmick can pass every engine measurement and still be UNPLAYABLE, because
"does it work?" and "can the player see it?" are different questions — reported
from real play as "the door gimmick is malfunctioning as user cannot see the door
or anticipate it happening."** The gimmick audit had driven every 🚪 side door
headless and proved enemies enter at the marker; it never asked whether a human
could tell. Three defects sat behind that one sentence. (1) **The marker wore the
EXIT's own 🚪** — the same picture for "enemies come IN here" and "enemies escape
here and cost you lives". That is exactly the class the enemy-art pixel hash
exists to catch (no two enemies may render identically), never applied to FIELD
MARKERS; a side door IS a second spawn, so it now wears the world's `spawnGlyph`
(a data field, so a new world inherits it). (2) **It was drawn during BUILD only.**
The code's own comment claimed "once the wave is walking the enemies themselves
say it" — but they walk in BEHIND your guns, so the marker that would explain
them vanished exactly when it was needed. It now stays lit while any wave using
it is in flight (a RANGE `waveIdx..sentIdx-1`, since TD-15 lets waves overlap).
(3) **The next-wave preview never mentioned it**, so gold was committed blind; it
now shows `🚪<count>`. The general rule: **a mechanic needs a marker that is
DISTINCT, PERSISTENT while it matters, and ANNOUNCED before the player commits
resources** — and the way to check is to screenshot it, not to re-read the sim.
Two smaller lessons came with it. Writing fix (3) nearly shipped a second bug:
spelling it out as "🚪45 side door" measured **310px of a 320px screen** in
headless Chromium, and `.td-nextwave` was `white-space: nowrap` — the documented
iOS-renders-emoji-WIDER trap that already spilled the tower panel once. Icon+count
(160px) plus a `max-width` and wrapping. And a testing trap worth remembering:
**`render.leverInfo()` (and now `doorInfo()`) report what the LAST DRAW did**, so
probing them after a `waitForTimeout` reads a stale frame — it showed lane 0 still
lit on all six fork levels including L10, whose readability fix is shipped and
tested, and looked exactly like a real bug. The suite's own test calls `r.draw(0)`
immediately before reading. When a hook reports "what happened last", MAKE it
happen before you read it. The other five gimmicks were screenshotted in the same
pass and are genuinely unambiguous (conveyor = cyan directional chevrons, mud =
brown gloop with no direction, night = dark floor + fireflies, power pad = amber
socket ring, lever = lit route + SHORT/LONG WAY label). The follow-up closed the
last gap that pass found: **TD-16 shipped five gimmicks and documented NONE of
them**, so `TDLogic.levelGimmicks(levelDef)` now DERIVES a guide entry from the
level's own fields exactly as `enemyTraits` does for the roster — a "Level tricks"
section in the Toybox Guide names each mechanic, says what it does, and lists the
levels it appears on. Its numbers are quoted from the engine (`RULES
.nightRangeMult`, the zone `mult`, the pad `boost`), never re-typed, and the
coverage guardrail walks every gimmick-bearing FIELD an author can set and fails
if it produces no entry — so a sixth mechanic cannot ship invisible, which is the
condition that produced the original complaint. Both halves mutation-proven
(delete the door branch → "L2 carries groups[].at but the guide says nothing about
it"; hard-code the night number → "must state the engine's actual nightRangeMult").

**华丽's world had never had a BEHAVIOURAL pass, and the first one found the
app-wide "never SPEAK a picture" defect.** The tap-harness proves a game is
winnable, not that its instruction makes sense, so the method was to drive all 40
of her games and capture what `JoshAudio.say` was actually handed. Two games
(什么变了 / 两幅找不同) said `"对！" + emoji + "变成了" + emoji + "！"` — which a
Chinese TTS voice reads as **"对！变成了！"**: the entire sentence was two
pictures, on the channel that carries her instructions. 找一找 had the same root
cause, saying "find IT" and only ever SHOWING the target. Running the identical
capture across all 240 games found one more, in Josh's world — Season Windows
saying "🌷 belongs in Spring!" → " belongs in Spring!" to a non-reader. The fix is
one name table per world (`SPOT_NAMES`, `SEASON_ITEM_NAMES`) as the single owner,
which also repaired the aria-labels (they were bare emoji too). This is the 🧯 →
"the fire extinguisher" lesson, which had been recorded but never applied
SYSTEMICALLY — so the guardrail is now generic: the every-game e2e harness wraps
`JoshAudio.say` and fails any game that speaks an emoji, and the content truth
tests fail if a pool picture has no name. Lesson: when a fix is recorded as a
one-off ("we named this one emoji"), ask what SCANS for the rest of them — and a
capture-what-it-says harness is cheap once the every-game driver already exists.

**TD-17: a toggle with no downside is not a decision — the track switch is now a
TIMED diversion.** Reported from real play: *"nobody would ever NOT choose the
long path and just leave it."* Exactly right, and it was a design hole rather
than a bug: the long route is strictly better for the player (more time under
your guns) and cost nothing, so the correct play was to throw it once on wave 1
and never touch it again. A permanent free upgrade dressed up as an active
control. It now runs for `RULES.leverHold` seconds, **snaps back on its own**,
and re-arms `RULES.leverCooldown` seconds after that — so the question stops
being "is the long way better?" (always yes) and becomes "WHICH part of this wave
do I spend it on?". Five things worth keeping: (1) **the numbers came from a
sweep, not a guess** — at 63% uptime it was still near-free, at 42% the payoff
went noisy, and **10s on / 10s off (50%)** lands the gradient the mechanic wants:
on L23 a 9-pad board goes 0/4 seeds → 4/4 with the diversion, an 8-pad board
3/4, and a 7-pad board still loses, so it is decisively worth using but no longer
SUBSTITUTES for building. (2) **The campaign needed no re-tune** — the
winnability oracle never pulls the lever, so all six fork levels re-simmed
byte-identical. (3) **Fast-forward is inherently correct because the timer is in
TICKS** — the frame loop is `acc += elapsed * speed`, i.e. speed buys ticks, so
at 3× the clock drains 3× faster in wall-clock AND the wave marches 3× further:
the same diversion either way. Pinned by feeding identical tick counts in
different batch sizes and asserting identical lever state *and* identical enemy
progress. (4) **A timed effect must not be checkpointed** — `leverRoute: 1` rode
the midRun save, and persisting that without its expiry tick would restore a
diversion that never ends, reintroducing the very thing being removed (the same
reasoning that already excluded `leverCd`); a resumed run now comes back armed on
the short route, and the old "the thrown lever survives a resume" test was
re-pointed rather than deleted. (5) The lever is **wave-only** now, like every
other timed effect (a build-phase pull would burn the whole diversion on an empty
lane), and its three refusals speak through the abilities' existing hint line
instead of a silent blip. **The testing lesson is the sharpest one:** the "the
countdown is VISIBLE" guardrail was written as a pixel hash and survived TWO
mutations — deleting the numeral still changed those pixels, because the draining
ARC moved, and then because the lever sits ON the lane and marching enemies
repainted the sample. Both times the test passed for a reason it did not claim.
It now wraps `fillText` and asserts the exact expected integer is drawn AT the
lever, which fails on all three mutations (no numeral / frozen numeral / no
auto-revert). When a visual assertion is confounded, stop widening the tolerance
and go read what was actually drawn.

**A touch law applied to TAPPABLES only is a law with holes in it.** Reported from
real play: *"sometimes when double tapping the screen will zoom in and it's often
hard to zoom back out"*, and *"touch and hold will highlight element as if it were
text"*. Both were real, and both came from the same gap — `touch-action:
manipulation` and `user-select: none` were on `.tap/.tile/.choice/.btn-*` only, so
every gap between tiles, every prompt line, every HUD label and all the screen
padding still carried the iOS defaults. A stray double-tap that misses a button by
a few pixels lands on that background and zooms; a long-press on any label selects
it and raises the callout bubble. The fix is page-wide (`html, body` plus the
screen containers) because **`touch-action` resolves by INTERSECTING down the
ancestor chain** — so one declaration kills double-tap zoom everywhere, while
still permitting panning AND pinch-zoom, which means deliberate zoom (the
accessibility case) is untouched. Three things worth keeping: (1) **it cannot
loosen anything** — the fort canvas declares the stricter `touch-action: none` and
`none ∩ manipulation` is still `none`, so it keeps owning its gestures; a blanket
`*` rule would have been the wrong shape, and the guardrail asserts the canvas
value precisely so that stays true. (2) **The EXEMPTIONS are the risky half** —
killing selection everywhere silently breaks the only two flows that need a caret
and the iOS paste menu (the fort's 💾 Backup box, which copies a save out and
takes one back and even calls `.select()` on focus, and the two type-the-word
`reset` gates), so `input, textarea, [contenteditable]` opt back in to
`user-select: text` + `-webkit-touch-callout: default`, and that is guardrailed
too — losing paste there would be a worse bug than the one being fixed. (3) **The
obvious fix is the wrong one**: `user-scalable=no` / `maximum-scale=1` in the
viewport would also stop the zoom, but iOS has ignored it since iOS 10 (so it
would not even work) and it removes pinch-zoom for low-vision users. Stop the
ACCIDENTAL zoom; never ban zooming. All four claims mutation-proven, including
one mutation that correctly did NOT fail (a blanket `*` rule leaves the canvas
alone, because `*` loses on specificity) — which is worth noting because it means
the canvas assertion guards a different regression than the one first guessed.
**Worlds 7-8 took the campaign to 32 levels, and every real defect they surfaced
was a guardrail whose SCOPE was a hand-written list.** Four instances in one pass,
all now derived: (1) the `FIELD_TRAIT` table that enforces "every special field an
enemy carries must produce a Toybox Guide line" hand-listed the twelve fields it
checked, so it had eight holes — and **four were live: `stomp`, `phases`, `suck`
and `enrage` were SHIPPED boss mechanics with no card line at all** (the Bed
Monster's unblockable stomp, the Static's hp-gated kit, the Vacuum King's
soldier-suck and its enrage). The very guardrail written to stop a mechanic
shipping invisible could only catch you after you remembered to edit it. The field
list now derives from the union of keys across `DATA.ENEMIES`, and a field must
either name its trait or join an explicit `NOT_A_TRAIT` set with a reason. (2)
`W5 wave composition` read `l.world === "garage"` and stayed that way through
three more worlds, so moving/newhouse/sortline were *emitted* against the ≥70%
backbone contract and then never *checked* against it; measured before widening —
those four pass, the four older worlds genuinely fail (L10 w2 is 74% mole), so the
ruled set is `["garage","moving","newhouse","sortline"]` in both the test and
`tools/td-wave-gen.js`. (3) `TD7 lever advantage` was hard-pinned to `l.id === 10`
while the lever spread to eight worlds — and **L3's lever was worth exactly 0.0
lives at every board size from 4 to 9 pads**, because its detour branched 76% of
the way down a 46-cell lane and there was no board left downstream to exploit.
Legality had been checked; VALUE never had. Re-searched (`RESEARCH=1
tools/td-fork-search.js`, a new flag — a fork can be legal and worthless) to a
split at 30% for +2.0 lives at the thinnest board, and the guardrail now walks
every fork with a measured thin-board cap plus a POPULATION floor (≥4 of 8 must be
outright decisive), since L3 and L10 are winnable at every board size and cannot
produce a phase flip. (4) The `--check` tool's own ruled set had the same gap.
**The balance lesson is that an 8-seed sweep is the minimum honest sample:** the
shipped `AUDIT heroic is a SLOPE` drives seed 7 only, and **L30 LOST on heroic
seed 5** while passing green (fixed by sweeping startGold 1450→2050; 1600/1750/
1900 all still lose that seed). Two NEGATIVE results, recorded rather than forced:
L29 measured heroic min 2 and raising its gold to 1450 fixes the floor but pins
normal at a flat 20/20 on all 8 seeds — a worse trade, so it ships at 1350 with a
tense heroic; and **L30/L31 finish 20/20 on normal and no side-door dose fixes it**
— normal stays pinned at 20 at every dose while the doses big enough to matter
make L31 lose 3 of 8 heroic seeds. That is the threshold domination this file
documents, reproduced on a fourth and fifth level. Also recorded loudly per the
TD-4 law: **World 8's `plated` coverage-gap exploiter and its Sealed Tin enemy
were CUT**, because at every budget-legal dose four independent arms returned
byte-identical results — worth zero lives on a full board — for the cost of a new
engine field, two read sites and the documented Fan-zap rounding trap. A world
with no new mechanic is a legitimate outcome; an unrecorded one is the defect.
**The first art audit of the whole app found that the fort's enemies were
STRUCTURALLY invisible and Josh's default buddy was a peanut — and the fixes are
both centralized, so a 46th enemy and a 201st game inherit them.** (1) **THE
SILHOUETTE LAW.** Measured WCAG contrast of each enemy's dominant body colour
against the lane it actually walks on: acorn **1.05:1**, housekey 1.06, yoyo 1.14,
chair 1.27, marble 1.43, sock 1.58. Every lane in every world is a light tan
(luminance 0.387 attic → 0.661 New House), so a pale body is not one bad colour
choice, it is the whole roster against the whole road — and two sprites already
carried a hand-added rim precisely because their swarms had vanished. Rather than
bolt a `rim()` call onto each of the 45 draw branches (which a 46th would not
inherit — the failure mode this project keeps re-learning), the ink line
INTERCEPTS the enemy pass: inside `withInk()` every `fill()` is followed by a
stroke of the same path in near-black, with `noInk()` opting out shadows, reveal
glows and hp bars. Four things the measurement taught that guessing would not:
**fill-then-stroke, not stroke-then-fill** (stroking first puts half the pen under
the body, so at dpr 1 only ~0.7px of a 1.35px line survived and 35 of 45 types
stayed pale); **a stroke-only sprite needs the ink too** (the Runaway Clip is a
hollow wire with no fill anywhere and the Battery Bot's shell likewise — they
measured 186 and 191 against a rimmed roster at 24-68, so a fill-only
interception would have shipped exactly two invisible enemies and called the law
satisfied); **`strokeRect` bypasses the path**, so the die's own `#8d97a8` outline
painted a PALE line straight over the ink and left it the one sprite with no
contour; and the guardrail's metric had to be the **darkest luma in each boundary
pixel's 3×3 neighbourhood**, because the raw boundary pixel is antialiased against
the lane and reads bright even on a properly rimmed sprite. Cost measured, not
guessed (the TD-6 rule): 2.15 → 3.51 ms per draw at L24's 125-enemy peak against a
16.7 ms budget, now pinned by a perf guardrail. (2) **Three of the four Fan
variants fired with NO visual at all** — `emit` is called at the dart and mortar
sites and zero times in the `zapDps` branch, so tiers 1-3 and the Blizzard branch
changed nothing you could see for 300 gold. The beam target was computed and
thrown away; it is now recorded on the SAME `t.targetId` the Dart already uses
("what this tower is engaging") rather than a second parallel field, and drawn as
a crackling arc. An event would have been the wrong shape: the beam is a STATE,
and one event per tick per fan would blow the 400-cap buffer that already ate this
project's damage tallies once. (3) **Projectiles were drawn un-lerped** while
every enemy lerped — a dart travels 0.30 cells/tick, an 8.1px teleport at cell 27,
so the one fast-moving thing on the field was the one thing that stuttered. (4)
**The exact-hash distinctness test only ever caught a MISSING branch**, so two
enemies could be 98% alike and pass (four pairs measured a dominant-body RGB
distance of exactly 0); a near-twin check now compares a coarse signature over a
TIGHT box around the sprite — over the full sample box, 96 of 100 grid cells are
identical background and diluted every real difference by ~25×. (5) On Josh's
side: **the default buddy read as a red peanut.** `buddy.js` builds its roster
HEROES-first and falls back to `ROSTER[0]`, so `hero()` IS the companion on the
home screen and the celebration pop on all 200 wins for any child who never opens
the picker — and it was four shapes, with a body ellipse and a head circle in the
same colour and tangent, fusing into a figure-8, no arms, legs or hands, and web
lines at 0.16 alpha that were invisible AND crossed the eyes. Redrawn as a posed
figure; the guardrail counts drawing ELEMENTS and ink extent, so "is a valid
balanced svg" is no longer the whole bar. (6) **The Sticker Book had 73 unique
pictures for 200 slots** — 160 of 200 games shared a prize and the largest group
was **25 games holding a byte-identical rocket**, because `rocket()` was the one
art kind that discarded its colour argument and the key had only two axes (8 kinds
× 12 colours = 96 combinations for 200 games). Each sticker is now a picture on a
shaped BADGE, and the implementation lesson is precise: **slicing one hash into
bit-fields correlates the axes through the modulo** (12 and 5 do not divide a
power of two) and left exactly the 5 colliding pairs the birthday bound predicts —
a second, independently-seeded hash plus two more axes took it to **200/200
unique**. (7) 170 of 200 slots were the identical ❓; an unearned slot is now a
faint grey GHOST of the sticker you will win, so the book reads as a collection to
fill. (8) `api.mascot()` drew `numberFriend(1)` — one cube, a 31.7 × 11.5 px pill
inside a 72px box — and it was a generic blue block in all 22 games that call it
while `JoshBuddy` already owned "which character represents Josh"; it reads the
same buddy now, so the friend you pick turns up beside you while you PLAY, not
only when you win. (9) **Every pup was the IDENTICAL beige dog**, and the only
per-pup mark was a `<rect width="40" height="8">` collar — **16.8 × 3.4 CSS px** at
the rescue game's dot size, repeated across 12-22 dogs, with `#ffd24d` beside
`#ff9f43` and `#e23636` beside `#ff7ac0`. Paw Patrol Rescue is a COUNTING game
whose right answer depends on telling six dogs apart, so it was asking a
four-year-old to do 3-pixel colour matching — the documented "a puzzle read off a
drawn scene must keep that scene UNAMBIGUOUS" law, and the one item in the audit
that was a DEFECT rather than polish. Each pup now differs in coat, ear shape,
patches and cap; the spec lives in `content.js` `PUPS[].art` so it is truth-tested
exactly like the friends' distinctness, and the whole pup is threaded through the
scene (it used to pass only the collar, so a silhouette would never have reached
the field). Worse, `.find__field--dense` separated them with **flex `gap`**, which
Safari 14.0 drops — on Josh's actual iPad the dogs TOUCHED while every headless
browser showed 6px; it uses child margins now and its entry came OFF the flex-gap
allowlist, since the point of that list is that joining it is a conscious act.
(10) Two more fort surfaces: **night REPLACED the world's floor** with a flat
blue-black, throwing away the one surface that says which room you are in (it dims
the real floor now, so the backyard's grass is still grass after dark), and **the
exit — the only way you lose a sticker — was a faint green dot the same size as
the spawn**, indistinguishable from it on a board whose entire point is stopping
things reaching it; it is a striped hazard threshold with a warning glow now.
Each world also declares its own **road style** (`ties`/`stones`/`tape` walked
along the lane's arc length, plus a real lit cross-section via an offset ribbon):
the lane is 19.4% of the canvas and the surface the eye tracks for a whole run,
and **bedroom, toystore and garage shipped literally the same road** because three
worlds had no `road` field and fell through to a shared default. The floor
guardrail now takes a SECOND hash over the lane corridor only — the whole-canvas
hash would happily pass two identical roads on the carpet-vs-tile difference alone.
**And the sticker-ghost fix immediately re-taught this project's oldest lesson the
hard way: a CSS `filter` on an element rendered BY THE HUNDRED is a WebKit
rasterization cliff, and the dev sandbox cannot see it.** The ghost was
desaturated with `grayscale(1)`, which forced each of the Sticker Book's 200 SVG
subtrees into its own rasterization pass. Locally `mobile.test.js` passed in **17
seconds** and the whole suite went 583/583 — because WebKit is not installed here
and the mobile suite falls back to Chromium. CI, which runs REAL WebKit, **stalled
in its test step for over an hour** (against an 18-33 minute historical norm).
Diagnosis by elimination, not guesswork: the engine suite was timed at 13s for the
new lever guardrail, `mobile.test.js` at 17s on Chromium, so the only genuinely
new *compositing* cost on a screen the mobile audit walks was those 200 filters.
The fix loses nothing — 22% opacity alone already reads as a ghost, because the
silhouette is legible and the colour washes out against the card. The guardrail is
scoped to what actually bit (a filter on a container of DRAWN ART rendered in
bulk) with `.tile__badge`'s `drop-shadow` on a 1.25rem ⭐ explicitly allowlisted,
since it has been green in CI for dozens of runs and a checker that flags
proven-fine design is one nobody reads. Meta-lesson, now twice-learned: **"the
full suite is green locally" is not evidence about iOS** — and a WebKit-only
regression can present as a HANG rather than a failure, which looks nothing like
a test going red. **And the filter turned out to be only the FIRST of three
Chromium-invisible costs in the same change — finding the others took timing every
suite in isolation, which is the only honest way.** Per-file: `site` fast,
`td-logic` ~14 min CPU (the 32-level sims — inherent), `e2e` 593s, `td` **69s**,
`mobile` **17s**, `offline` 6s. That cleared every file I had touched and left the
one CI-only variable: real WebKit. Two further costs were cut on that reasoning,
and both matter on Josh's actual iPad too. (a) **The ink line stroked after EVERY
fill** — ~8 per enemy, ~800 extra round-joined strokes per frame at the 125-enemy
peak. It measured 2.15 → 3.51 ms of a 16.7 ms budget… on GPU-accelerated
Chromium, while WebKit rasterizes in software where wide round-joined strokes cost
far more. It now spends a per-sprite BUDGET (`INK_PER_SPRITE = 4`), halving the
work and capping it so a future detail-heavy sprite cannot inflate it.
One-per-sprite was tried first and measured too FEW — 7 enemies (bull, healer,
battery, screw, tinplane, racer, housekey) draw their body after their first fill,
and the silhouette guardrail caught exactly that. (b) **The sticker badges used a
24-point rosette and a 20-point burst, ×200 on one page** — every shape is ≤8
points now and the sparkles are circles rather than 8-point stars (13 polygon
points, ~1KB per sticker), with all five uniqueness axes intact at 200/200. The
generalizable rule: **when you add art to a surface rendered by the hundred, count
the path points — and never conclude its cost from a Chromium measurement.**

**A SYMBOL THE PLAYER CANNOT DECODE IS A MECHANIC THEY CANNOT PLAN AROUND** —
reported by the owner as, simply, *"what's the gear symbol mean at top of play
space?"*. ⚙️ Toy Energy is the fort's second currency (the whole reason the powers
stop being free once a board holds thousands of gold), and it shipped as a BARE
NUMERAL: the glyph appeared in the HUD, on all four ability buttons and in the
guide's cost lines, and **nothing anywhere in the app ever named it**. That is the
identical defect TD-12 fixed for the abilities, whose names lived only inside an
`aria-label` — recorded then, and re-committed three phases later on a resource
whose entire job is to be budgeted. The fix names it in all three places (a HUD
`title`, a live `aria-label` carrying the value, and a Powers paragraph in the
Toybox Guide that quotes `RULES.chargePerWave`/`chargeMax` rather than re-typing
them), and the guardrail asserts each. **The general rule: when you add a
RESOURCE, the test that it is explained is not optional — ship the name with the
number.** The touch-law pass that came with it closed the other half of "the page
must not move under a thumb": `touch-action` stops the double-tap zoom and nothing
else, so the rubber-band bounce, **pull-to-refresh (which can RELOAD mid-round and
drop it)**, and scroll CHAINING out of an inner scroller onto the page behind an
open dialog were all still live. `overscroll-behavior: none` on the root plus
`contain` on every internal scroller kills all three, cannot touch pinch-zoom (so
the deliberate "stop the ACCIDENTAL zoom, never ban zooming" choice is intact),
and is guardrail-locked by a generic scan: any rule with `overflow-y: auto|scroll`
must also declare `contain`. Honest floor, stated rather than glossed: Safari added
`overscroll-behavior` in 16, so Josh's iOS 14.2 iPad ignores it — it is the whole
fix on Android, desktop and any newer iPad, and nothing regresses on 14.2.
**And Dump Truck! — the namesake game — was a 🚚 DELIVERY-van emoji glued to a flat
orange div**, while `JoshArt.truck()` had exactly one caller in the repo (the
sticker book) and was never seen in a game. A dump truck's whole appeal is the bed
going up, and an emoji cannot tip, cannot show a partial load, and is not even the
right vehicle. `truck(color, {tip, load})` now renders the bed at any angle with a
countable pile of rocks in it, so loading and dumping are one picture changing; the
CSS tilt and the flat orange bed are retired with it (an SVG attribute change is
instantaneous, so the tip is motion-safe by construction instead of needing a
`prefers-reduced-motion` opt-out). The lesson is the tap-harness one again: it
proved this game winnable for its whole life without ever noticing the picture
never changed, so the browser test drives the real controls and READS the drawing —
asserting n rocks land in the bed for n taps, that it stays level while loading,
and that the lever tips it (mutation-proven on all three).
**The choice card and the sort bin are the most-rendered surface in Josh's world
and were the emptiest** — 121 of 200 games build `.choice` buttons and 11 more use
`.sort__bin`, and on an iPad in portrait a bin measured roughly 320 × 235 CSS px
carrying a FIXED 2.6rem emoji: about 2% ink coverage, so "Alive or Not?" read as
two enormous blank rectangles with an accidental-looking picture in each. Fixed in
the stylesheet alone, no per-game work: the bin icon now scales WITH its card
(`.choice` already did), both grids cap at 620px so they stop ballooning on a
tablet, the bin gained a drop-LIP so it reads as a container rather than paper, and
a correct drop pops it. Two laws came out of it, both generic and mutation-proven:
**an absolutely-positioned `::after` must have a POSITIONED parent** (a static one
lets the pseudo escape to the nearest positioned ancestor — the `.td-overlay`
absolute-vs-fixed bug in miniature, and the bin's lip is the first pseudo in the
app to depend on it), and **every `@keyframes` that something actually animates
must be switched off in the `prefers-reduced-motion` block** — previously a
convention the repo followed by hand, now a scan that walks every keyframe, finds
its users, and fails if none of them is named in that block.
**`numberFriend` is the countable in three maths games and it was not made of
cubes** — the drawing pinned the WIDTH at 44 and divided a fixed 76-unit height
between the blocks, so a "cube" ran 2.75:1 at n=1 and **7.86:1 at n=10** (a stack
of stripes, in games that ask a four-year-old to count them); the face was placed
by a fixed 4-unit offset from the top of the stack, so at n=10 the mouth was drawn
in the GAP between cube 1 and cube 2, off the body entirely; and **ink was not
monotonic in n** — it peaked at n=5 (29.0% of the box) and fell to 24.6% at n=10
with the height flat at 74 for every n from 5 up, so in `add-up`, whose whole beat
is two friends MERGING into their sum, 4 + 5 = 9 drew a sum smaller than either
addend. Cubes are square now, in balanced bottom-anchored columns of at most three
(4 is a 2×2, 6 a 2×3, 9 a 3×3, 10 a 3+3+2+2 — the shapes the show uses, and a ten
that is countable rather than a sliver), sized from a deliberately MONOTONIC ink
budget so a bigger number is always a bigger friend (14.6% → 40.0%), with the face
derived from its own cube's box. Four guardrails, each mutation-proven against the
old behaviour: square, monotonic, face-inside-one-cube, nothing outside the
viewBox. Lesson: when a drawing is the ANSWER to a counting question, its geometry
is correctness — and "is it a valid svg" was the whole bar before.
**Measuring the win pop found a defect nothing tested: the Again button lands
BELOW THE FOLD on short screens.** Driving real wins at five viewports, the
just-revealed button sat 37px past the bottom on a 320×568 phone in odd-one-out
and 35px in music-pad, 64px down on a 360×640 in count-feed, and **156-220px down
in every game sampled in landscape** — Josh wins and the one button he wants is
off the screen. Every win test only ever read `screen.dataset.won`. The win path
now scrolls it into view from the ONE place a game is won, so all 240 games
inherit it (reduced-motion honoured). The pop itself was a flat 120px at every
size — 38% of a 320px phone, 16% of a 768px iPad — and lands ON the just-played
board, so it scales with the viewport now and carries a soft halo: a background
gradient, **not a filter**, because a filter on a thing that renders on every
single win is the documented WebKit rasterization cliff. Its `bottom` also needed
a px FLOOR: 14% of a 640-tall phone is 90px against a 92px Again-button reserve,
a measured 2px overlap. The guardrail derives that reserve FROM THE APP (measure a
tall viewport where nothing scrolls) instead of hard-coding 92.
**华丽's world had never had a PAINTED-CONTRAST pass, and her primary navigation
measured 1.90:1.** Computed styles cannot see it — her page is a gradient and the
failures are simply the labels that happen to sit low on it — so the method was to
screenshot each screen twice (once with all text ink made transparent), decode
both PNGs, and score each run's most fully-covered ink pixel against the
background revealed underneath. Two sampling traps first: scoring the WORST ink
pixel makes every run on the site "fail" (antialiased edges are a blend of ink and
background), and an emoji-only run is ART, not text. Findings, all reproduced
independently of the audit spec: **her seven category tiles at 1.90-1.93:1** —
ONE cascade bug did both halves, since `.hl-tile`'s cream card comes later in the
file than `.tile--cat` at equal specificity (so every category painted identically
and `--cat-color` was never rendered — seven identical pictures with different
emoji), while her dark-red label landed on `.tile--cat`'s 55%-black pill; **the 福
she is asked to TRACE at 1.39:1**, which is the task, not decoration, and alpha
alone cannot fix it on that red (0.60 → 3.04:1 computed), the box has to darken
too; `.music__hint` 2.02:1, `.hl-calmlabel` 3.44:1, `.hl-diffvs` 4.40:1; the
shared sticker meter's numeral at 4.37:1 on a FULL gold fill — a latent failure
that appears exactly when the number matters; and Josh's Surprise label at 4.24:1.
All fixed and re-measured to 0 failing runs of 143. Three laws came out of it:
**a gradient with a TRANSLUCENT stop must use background longhands** (the
shorthand resets `background-color` to transparent, so that stop composites over
the page and a tile's colour drifts with its scroll position — an opaque gradient
is safe and stays exempt); **cream text in her world must carry its own plate**,
since L(#ffe9b0) is 0.827 and needs a background luminance ≤ 0.145 while her gold
end is 0.423 — so no bare cream can EVER pass there, with an exemption list that
must NAME the ancestor providing the plate and that ancestor is then checked; and
the plate rule is the single owner of those colours (the old per-rule cream
declarations were deleted rather than left to lose the cascade). Two shell fixes
with the same shape: her top bar said **"Josh's Games" in Josh's blue** in every
world, now named by `route()` — the one place that knows which world is being
entered — and her shell used the **same 🏠 for two destinations** (her home's
button exits to the front door, a category's returns to her home), now 🚪 vs 🏠
exactly as Josh's world already did. And her navigation was **the smallest text on
the site** — 12.8px game titles, 15.2px category titles, in the only world whose
user reads — so it is two columns at 18.4px now: every title on one line, 132px
taps, 16px gaps, no overflow at 320/390/414, her category screens filling a
viewport they were wasting half of, at the cost of one flick on her home.
**45 of 240 tiles shared their PICTURE with a sibling on the same category
screen** — RULE 5's first law is "zero reading required, icons carry the play",
and `#cat-numbers` showed a four-year-old THREE identical 🔟 tiles (Build the
Number, Ten & Some More, Make Ten), separated only by a 12.8px English label he
cannot read: he could tell them apart solely by remembering grid position. 21
groups in all (🔎×3 and 🕸️×3 too). This is exactly the defect the fort's
pixel-hash guardrail exists to catch — "no two enemy types may render
identically" — never applied to the ONE surface every game is reached through.
24 icons changed, chosen so the glyph stays with the game that OWNS it (the
seesaw keeps ⚖️, "Which Has More?" becomes 🍇; "Hop & Count" keeps 🐸,
"Number Line Hop" becomes 🦘) and every replacement passes both shipped emoji
guardrails (≤ Emoji 13.0, VS16 where text-default). The guardrail reads the LIVE
registry in the browser — a Node require only loads part of it — and is
deliberately per-CATEGORY, since cross-category reuse is fine (a child never sees
`#cat-science` and `#cat-find` side by side).
**On Josh's REAL device — an iPad — the launcher gave him MORE tiles, not bigger
ones.** `repeat(auto-fill, minmax(84px, 1fr))` inside a 720px cap grows in COLUMN
COUNT and never in track size, so 768×1024, 810×1080 AND 834×1112 all measured
**seven columns of 85×120px** — the same tile as a 320px phone, at maximum
density, with 45-57px of dead gutter each side; the front door was three
letterbox strips and her world served 12.8px Chinese on a ten-inch screen.
Nothing saw it because `mobile.test.js` audited 390 and 320 only — *a viewport
list IS the test*, now the fourth instance of that class. A media query above
600px scales the TRACK: 810 wide now gives 4 columns of 183×180 on the home,
5×143 in the Sticker Book, 3 doors of 249×260, 3×249 in her world. Two
implementation traps, both of which produced a silently-wrong layout: a `@media`
block that OVERRIDES base rules must come after them in the file (moved to the
top it lost every override at equal specificity and looked like the query wasn't
matching); and **`margin-left/right: auto` on a FLEX ITEM cancels the stretch and
shrink-wraps it** — `#screens` becomes a column flex container in a game, so
capping the game screens back to 720px with auto margins collapsed her home to
320px until an explicit `width: 100%` restored a definite cross size. The cap is
deliberately scoped so all 240 in-game stages keep their old measure.
**The front door — the first screen anyone sees and the only route into any
world — hid the third world below the fold**: measured 152px past the bottom at
320×568, 42px at 360×640, 15px at 375×667 and 63px in landscape at 844×390, with
nothing hinting the 🏰 world exists. Its own test ran at a fixed 780px height,
which is exactly why it never saw it. And measured as INK rather than boxes, the
three doors were not peers — Josh's `JoshArt.friend` portrait inks 56×77 where
👵🏻 inks 58×63 and 🏰 inks 72×70, so the PRIMARY door carried the lightest mark
and the three labels sat at three different heights (a 21px spread). One shared
mark box (spread 0) and a short-screen block (every door above the fold at every
tested size), both mutation-proven.
**A cue that does not survive to the size the game is PLAYED at is not
delivering its information** — the fort's tower tier pips are `u * 0.045`, which
at the 390px phone's real cell of 27 is a 2.4px dot (1.5px at 320), three of them
3.8px apart. Tier now steps the PLINTH RING's colour instead (bronze → silver →
gold; tier 1 has no plinth, which is its own signal), a ~24px ring that was
already being stroked, so the change costs nothing. Measured per-tier pixel
difference at cell 27 rose modestly (mortar 1→2 187 → 218, fan 2→3 370 → 397) —
and the raw count deliberately understates it, because only the ring's own
pixels changed hue. The honest statement is that the cue moved from a 2.4px dot
to a 24px ring in a distinct colour. Note the existing per-tier pixel-hash
guardrail stayed green throughout, which is exactly what the pips were worth: it
was never measuring them.
**The Sticker Book's DOM had TWO owners** — Josh's 200-slot book and 华丽's
40-slot book each built the same three meter elements and the same slot
structure from scratch, ~50 duplicated lines apart, while the shared CSS, the
live `josh-won` plop, the `[data-sticker]` lookup and the `is-won` replay all
assume ONE structure. `JoshStickers.meter()`/`slot()` are that owner now, and
the guardrail asserts both books call them AND that neither hand-rolls a
`sticker-meter`/`sticker-slot` any more. Same class as `josh-won-*` having three
writers and the fort's save reset having two.
**P6a — the fort's power strip became a CHOICE, and the item that justified it
was a measured coverage hole rather than a feature request.** The strip cannot
grow: the portrait rule is a hard `repeat(4, minmax(0,1fr))` and the shipped
guardrail proves a cloned 5th tile physically OVERLAPS at 320px, so a new power
had to be a decision, not a button. Mirroring `RULES.metaSlots`, a run now
EQUIPS `RULES.abilitySlots` (4) of a 5-power pool through one owner
(`activePowers()` in td-main), and **📌 Call the Shot** is the fifth: tap a body
and every gun on the board aims at it for 5s (70🪙 · 2⚙️ · 24s). Six things
worth keeping. (1) **The hole it closes was real and quantified**: neither
oracle plan (DART, MIXED) ever builds a camp, so `abilityWouldDo` returned false
for 📣 Rally Horn on *every run the entire suite makes* — including the audit
whose whole job is "spamming the powers must not erase a finale". One of four
powers was inert in every test, and a player on a dart board carried a
permanently dead tile. The new **`P6 coverage`** guardrail hands each power
exactly what it needs and asserts it FIRES; it is mutation-proven by swapping
the camp out of the fixture, which is the shipped defect reproduced. (2)
**Focus fire needed TWO clauses, not one** — `pickByMode` is the single chooser
for the dart's acquire, the mortar, the Fan's beam and the chain's first link,
but the dart's `first` mode is deliberately STICKY, so one clause moved the
mortar and fan and left the most-built line inert. Deleting the sticky-KEEP
clause turns the dart row red while mortar/fan stay green — the exact shape of
the phased-ghost bug, reproduced on purpose as the mutation proof. (3) **The
mortar kept its target in a LOCAL**, so "what is this tower engaging" was
knowable for two lines of three; it records `t.targetId` like the others now
(never read by combat, so behaviour is unchanged) and that is what makes the
guardrail readable instead of inferring aim from where a shell landed. (4) **The
engine's `powers` default is the WHOLE pool, on purpose**, so every shipped sim
is byte-identical — and for the abuse audit a full-pool run is a strict UPPER
BOUND over every legal pack (a pack is a subset; `abilityReady` refuses what is
not equipped), which is why 📌 shipped only after that audit re-passed on all 8
finales × 8 seeds × 2 plans. Note the asymmetry with the P4 lesson: an
unreachable loadout tells you nothing when you are BLAMING individual nodes, but
a conservative bound is exactly right when the question is "can this erase a
finale". (5) **`save.powers` is the tenth instance of the persisted-field law**,
and rather than add an eleventh hand-written list, the `site.test.js` check now
DERIVES the field list from the loader's own coercions — which immediately
showed that `bests`, `loadout` and `powers` had all landed after the old
seven-name literal was written and none was covered. (6) The pack rides the
midRun checkpoint (read off `state.powers`, not the save, so editing the pack
while a run is parked cannot retroactively rewrite the run being restored),
while `markId`/`markUntil` deliberately do NOT — an absolute tick restored into
a fresh engine is the documented `leverCd` trap.
**P6b — 🦆 Rubber Duck fills the last EMPTY cell of the resist matrix, and the
whole item is a lesson about WHERE a multiplier may be applied.** Every tower
line already had an enemy built to shrug it off — `armor` blunts the dart's
bonk, `splashResist` soaks the mortar, `bonkResist` pads single hits,
`slowImmune` deletes the Fan's *slow* and a `shield` buffers its zap — but
nothing reduced the Fan's *damage*. `zapResist: 0.6` does (the same 0.6 the
Cushion and the Bubble Wrap use, so the roster's resists are one strength rather
than three), keyed on `how === "zap"` so it covers the beam AND the Static
branch's chain jump from the one `dealDamage`. Four things worth keeping.
(1) **The obvious implementation is a catastrophe, and its obvious test cannot
catch it.** The beam accumulates 6-16 dps into ONE point of damage per tick and
`dealDamage` rounds, so applying the fraction there makes `Math.round(1 × 0.4)`
= **0**: the Fan would deal literally zero damage to a duck at every tier, for
ever. So the multiplier rides the ACCUMULATOR (the same reason brittle and Boss
Bonker already do) and the `dealDamage` clause is gated `!preScaled`. The
verified trap is that a "it survives ~2.5× longer" assertion PASSES on the
broken build — surviving infinitely longer satisfies it — so the guardrail
asserts an EXACT ratio (±0.03 of `1 − zapResist`) at tiers 1/2/3, and is
mutation-proven three ways: drop the accumulator multiply → ratio 1.000; drop
the `!preScaled` gate → 0 damage; drop the `dealDamage` clause → the chain/`zap`
seam row goes red while the beam rows stay green. (2) **A resist must be proven
by the `how` seam, not by a time-to-kill** — the engine already exposes
`dealDamage` for exactly this, so the test fires 100 damage as dart / splash /
melee / zap at one pinned body and reads four numbers, with no confounds.
(3) **One resist per body.** The `≤1 disruptive special per wave` contract counts
GROUPS, not traits inside a body, so a duck that also carried a shield would slip
straight past the rule written to stop "shielded + resistant with no answer".
(4) The trait line is DERIVED (`enemyTraits`), so the Toybox Guide explains the
new counter the moment the field exists — and the derived `FIELD_TRAIT`
guardrail proved itself by going RED until `zapResist` was mapped, which is
precisely the job it was rewritten for.
**AND THE HONEST HEADLINE: `zapResist` is worth ZERO lives, because the Fan is
not a damage line.** Dosed HP-preservingly into L6 and L8's late waves at 0 / 4
/ 8 / 12% over 4 seeds, every plan and both difficulties moved by 0-1 life —
L8's four rows are byte-identical at every dose, and L6's shipped-oracle numbers
after placement (normal 18,19,19,19 · heroic 11,14,14,13) are *exactly* the
pre-placement ones. The reason is structural and was confirmed directly: the
MIXED plan builds 2 fans of 12 pads and leans on the SLOW aura, dart-mono builds
none at all, and a deliberately fan-heavy board **already loses L6 on every seed
at 0% ducks** — so there is no board for a counter to fan DAMAGE to bite. This
is the same shape as the recorded `plated` cut and the Tin Plane result, and it
is written down rather than dressed up: **🦆 is shipped as a legible completion
of the counter matrix and a distinct body, NOT as a difficulty knob, and a
future author must not reach for `zapResist` to make a level harder.** What
makes it safe to ship anyway is the same measurement — it is provably
outcome-neutral on the shipped oracle, so it cannot break a tuned level. Dose
placed at 3.5% of L6's HP.
**A WAVE GROUP MISSING ONE FIELD DID NOT FAIL — IT HUNG, and reported as an
unwinnable level.** Found while dosing the duck: `scheduleWave` computed
`Math.max(0, g.delay + i * g.gap + jitter)`, so a group authored without `delay`
made the spawn tick NaN, the enemy never arrived, and the wave never completed —
the sim dutifully reported LOST on every plan at every difficulty, and the first
read of that was "3 ducks flipped the whole level", which is absurd on its face
and is what gave it away. Exactly the class already documented for a `mult`-less
zone silently NaN-ing every enemy's `dist`. `(g.delay || 0)` and a default gap
now make it degrade instead of hang, and a new guardrail asserts every shipped
group carries numeric `count`/`gap`/`delay` AND that the engine survives one
that does not (mutation-proven by reverting the `|| 0`). Lesson: when a sim
returns an impossible result, suspect the FIXTURE before the balance.
**`__TD.resetSave()` did not actually reset — the run it wiped re-checkpointed
itself on the next navigation.** The shipped grown-ups button passes
`{keepPrefs:true, dropRun:true}`; the test hook passed nothing, so `cur` survived
the wipe and the very next `route()` ran `leavingPlay()` → `writeMidRun()` and
wrote a fresh `midRun` from the run that had just been reset. A later test
navigating to `#td-play` then bounced back to the fort home (a stale checkpoint
with no live run), which presented as an unrelated test timing out on a hidden
screen. It is the documented ✕-discard shape — something downstream in the same
call re-creates what you just deleted — and the fix is one word (`{dropRun:
true}`), pinned by the reset guardrail. The fort browser suite went 84s → 52s
afterwards, because tests stopped inheriting a parked run.
**HALF THE BOSSES WORE NO CROWN, and the four that did each drew their own.**
The fort home stamps 👑 on a boss finale and the Toybox Guide gives every boss
an "its kit escalates" line, so the ONE place a player could not tell a boss
from a big enemy was the battlefield itself — and the four unmarked ones
included **the first boss you ever meet (the Bed Monster, L4)** and **the
campaign's finale (the Big Magnet, L32)**. There is one `bossCrown()` now, and
the guardrail DERIVES its subject list from `DATA.ENEMIES` (every entry with
`boss: true` must call it), so a ninth boss inherits the check — mutation-proven
by deleting the Bed Monster's call. Two testing notes worth keeping: splitting
the enemy draw chain on `} else if (e.type === "` leaves the LAST branch running
to the end of the file, which reported the Toolbox Titan for a tier-4 TOWER ring
300 lines below it (truncate at the next `} else`); and a "no boss paints the
crown gold itself" check is a false-failure machine, because the same
`#ffd94a` legitimately paints the Tickmaster's clock pivot, a tier-4 tower ring
and a dart in flight — the one-owner claim is asserted directly instead (the
helper is defined exactly once).
**A NEGATIVE result on the same pass, recorded because a bad metric nearly
caused a 46-sprite re-tint.** The art backlog carried "four enemy pairs still
at RGB distance 0-5", so the roster's body colours were re-measured by rendering
each enemy and histogramming its ink. Three successive versions of that metric
were WRONG, each in an instructive way: the first binned the whole canvas and
reported every enemy's dominant colour as the FLOOR; the second diffed the floor
out and reported the silhouette-law INK RIM, which is identical on every sprite
by design; the third filtered by luma and still reported a mid-brown
`rgb(153,102,68)` that appears in no sprite's palette at all — it is the
ANTIALIASED BLEND between the near-black rim and the tan lane. The tell was the
pixel counts: 3-7 per bin, because the fixture rendered a whole battlefield into
120×120 and each enemy was about five pixels across. The actual palettes are
plainly distinct (Plastic Knight silver-blue `#cfd8e6`, Kite Hawk orange
`#ff8f5a`, Tin Plane pale blue `#d7dfeb`, Drip Slime green `#9df3b8`, Juice
Carton orange `#e8a45c`) — so the pairs the broken metric named are fine.
**But the ORIGINAL finding is real, and the first write-up of this paragraph
wrongly called it "not reproduced" — a claim made after testing the wrong
pairs.** Reading the palette LITERALS instead (no rasteriser, no antialiasing,
no sprite-size confound) and scoping to each world's ACTUAL enemy pool
reproduces it and makes it worse than "four pairs": every one of the eight
worlds has a colliding pair, and several are exactly 0.0 — garage `cog`/`bucket`
0.0 and `bucket`/`battery` 0.0; moving, newhouse and sortline all
`battery`/`bucket` 0.0; `knight`/`battery` **2.2 in six worlds**;
`screw`/`tinplane` **3.2 in five**. The cause is a steel monoculture: Plastic
Knight, Battery Bot, Loose Screw, Tin Plane, Bolt Bucket and Cog are all pale
blue-grey, and `#dfe6f0` is the literal same hex in two of them. Two lessons,
and the second is the one that cost the time: measure a palette from the SOURCE
when you can, because a rendered-pixel metric has to survive the floor, the
shared ink rim, the antialiased blend between them and a 5px sprite — and when a
re-measurement disagrees with a recorded finding, suspect the new instrument
before overturning the old number, especially when the new one names entirely
different pairs.
**FIXED, in three measured rounds, and the roster is now self-policing.**
🛡 Plastic Knight → blue plastic, 🔋 Battery Bot → electric cyan, 🔩 Loose Screw
→ bronze, 🪣 Bolt Bucket → teal, 📻 Boom Box → 80s magenta, ✈️ Tin Plane →
tin-toy red, 🦫 Digger Mole → slate (it had shared the Mud Blob's brown while
doing something completely different), 👻 Glitter Ghost → lilac, 🧽 Oil Rag →
oil-stained, 📎 Runaway Clip → lime, 🟤 Mud Blob → swamp olive. Worst pair
anywhere **0.0 → 11.7**, and the 131 pairs under 25 fell to 9 — every one of
which is a BOSS beside a small body, where 1.8-3.1× scale does the separating.
Two of the three rounds were spent fixing collisions the previous round had just
CREATED (a brass screw landed on the Spare Key's gold; a green battery on the
Drip Slime; an orange clip on the Grease Racer), which is the argument for
iterating against a measurement instead of picking colours by eye. The guardrail
lives in `site.test.js` because it needs no browser at all: **inside a world's
own wave pool, two bodies of comparable SIZE must differ by ≥20**, with the size
exemption DERIVED from `boss`/`size` rather than hand-listed. Mutation-proven by
reverting the Knight to steel.
**And the floor got FURNITURE, with the WHERE decided in the engine.** The board
is 336 cells, the lane takes ~65 and the pads ≤14, so about three quarters of
every screen was bare — the Bedroom, the Garage and Moving Day were told apart
by a palette and a hatch pattern alone, and the field read as a diagram rather
than a room. `TDLogic.propCells(levelDef, grid)` decides placement and lives
beside `enemyTraits`/`reachedBy`/`levelGimmicks` for the same three reasons:
it is testable with no browser, it has NO rng (a per-cell hash, so a level
always dresses identically), and it takes **no cell size**, so a `resize()` can
never shift a prop. Clearance is measured against EVERY lane — the TD-11 lesson
written as code, and mutation-proven: check only `paths[0]` and L3 immediately
grows a prop sitting 0.00 from its switch track. The art side is eight shared
primitives (box · blocks · bush · stone · tyre · tin · case · stain) that eight
worlds pick three of, so a ninth world costs a three-item list rather than three
drawings, and they are baked into the background at ≤0.62 alpha under the lane —
zero per-frame cost, never a face, never the pads' blue-steel. One
implementation note worth keeping: the first selector walked the eligible cells
on a fixed STRIDE, which only enumerates every index when the stride is coprime
with the length, so the tightest maps silently got 2 props instead of 7 — a
hash-ordered greedy pass with a two-stage gap fixed it, and 31 of 32 levels now
take the full 7 (the tightest takes 3, which the guardrail asserts as a floor
rather than pretending otherwise).
**P6c — ⛱️ Blanket Cover, the 4th gimmick shape, and the half of it that was
CUT.** `zones[].mult` scales TIME in range; `zones[].dmg` scales DAMAGE in
range. They are the two factors of the same integral, which is why it reuses the
same array, the same disjointness rule and the same renderer machinery as the
conveyor and the mud patch. Three things worth keeping. (1) **The SPOTLIGHT half
(`dmg > 1`) was measured and dropped.** It was the strongest single result the
spec found — a tail band at ×1.4 took dart-mono on heroic from LOST on every
seed to winning on two levels — and that is precisely why it cannot ship: it
flips exactly the property `AUDIT mono builds` exists to protect. So the bound
is deliberately ONE-SIDED (`0.70 ≤ dmg < 1`), because the two halves are not
symmetric knobs and a two-sided bound would be a bound nothing could hit.
(2) **Two mandatory call sites, again.** The clause in `dealDamage` covers dart,
splash, chain-zap, melee and ability with no call-site change; the Fan's BEAM
needs its own multiply at the accumulator, because it delivers 1-damage packets
and `Math.round(1 × 0.85)` is 1 — the same rounding trap that already ate
brittle, Boss Bonker and `zapResist`. Mutation-proven independently: drop the
accumulator and the beam row alone goes red at ratio 1.000; drop the dealDamage
clause and every other family goes red while the beam stays green. (3) **A zone
may now carry only `dmg`, so `effSpeed` had to stop trusting `z.mult`** — a bare
`base *= undefined` is NaN, which propagates into `dist` and freezes every enemy
on the level. That is the `delay`-less wave group all over again, and the
guardrail requires a numeric `mult` on every shipped band as well. Dosed by sim
at 0.85 on **L2 (the early teach), L18 and L26** — three worlds, normal within
the ±2 design rule on both plans, heroic −1 to −3, no mono result flipped,
neglect still losing. L9 was measured and REJECTED: World 3 is the documented
hardest world and the band took heroic/mixed from 7,7,3,5 to LOST on every seed.
**The post-P6 audit found ONE defect, and it was in a TEST — the same "a scan's
own list is part of the scan" class, on its fifth instance.** `AUDIT: every fort
overlay lands ON SCREEN` exists because the star-tree dialog once opened
hundreds of pixels below the fold and read as a dead button; its `OPENERS` was a
hand-written map of six, so the **🎒 Powers picker — the newest dialog in the
fort — was invisible to it**. The picker happened to be fine, which is exactly
the point: the test could not have told you either way. It now DERIVES the list
from the fort home's own `.td-metabtn`/`.td-adminrow` buttons (7 found, up from
6), with a `NOT_A_DIALOG` allowlist so 🧸 Kid Fort opts out on the record.
Mutation: give `.td-powers` the old `position: absolute` and it goes red on
exactly the dialog it previously could not see. Same family as the flex-gap law
guarding only `main.css`, the live-verify probe hitting only `index.html`, the
VS16 scan hand-listing nine files and `FIELD_TRAIT` hand-listing twelve fields —
when a list can go stale, derive it.
Everything else in the new surface held under eleven probes: a marked enemy that
DIES mid-mark is survivable; a hand-edited `save.powers` (empty, unknown ids,
duplicates, over-full, not-an-array) never crashes `createEngine` or
`abilityReady`; `zapResist` and a cover band COMPOSE correctly on the beam
(0.200 measured against 0.200 expected — each multiplier applied once, not
twice); `propCells` dresses all eight ENDLESS arenas (7 props each) despite
their string ids; no side door opens inside a band (33 vs 3-18 on L2); every
band is a FRONT band (5-28% of its lane); no prop lands near a spawn or an exit;
and the three banded levels still replay identically.
**And the honest counterpart to 🦆's zero: 📌 Call the Shot measures 2.50×.**
Parking a fat body in a crowd of chaff on a six-gun board and pointing every gun
at it dealt 60 damage in five seconds against 24 unmarked. So the two P6 powers
sit at opposite ends — one is a real lever, one is legibility only — and both
numbers are recorded rather than assumed. The rule the pair teaches: **measure
what a new power is WORTH the same way you measure what a new enemy costs**,
because "it fires and the suite is green" says nothing about whether it changes
a board.
**The four measured DEAD ENDS (RULE 7 step 3), so the next pass does not rebuild
them.** (1) **`hitCap` ("no single blow may exceed N") is not a new axis** — for
any tower whose per-hit damage exceeds the cap, effective HP scales by
`dmg/cap`, so a hit cap IS a line-keyed HP multiplier with extra steps, and
bigger HP piles are already documented as not working. (2) **A coverage-gap /
front-guard enemy is dead before it is built** — kills are front-loaded (73.4%
in the first four lane deciles) but DPS is NOT (L20 carries 98 dps-units across
deciles 1-4 against 295 across 5-10), so an enemy that survives the front meets
an idle 75% of the board. That independently re-derives the shipped Digger-Mole
result and explains WHY it measured zero. (3) **An un-jam power is worth ~nothing
** — jammed tower-time under the mixed plan is 0.00-0.73% across L16/L20/L22/
L24/L28; note this is a statement about the PROBLEM, not about the shipped 🧰
Field Repair node, which does halve jam duration. (4) **`pads[].unlockWave` is a
landmine** — the shipped oracle's fill loop `break`s at the first empty pad
whether or not `place()` succeeded, so a pad that can refuse would stop the
solver building anything at all for the rest of the run. Any future pad-gating
field must be proven against that loop first, in BOTH copies
(`tests/td-logic.test.js` and `tools/td-sim.js`).
**A proposed guardrail was MEASURED and replaced by a better one — the honest
outcome when a law turns out not to be a property of the shipped game.** The
content spec's corrected form of its dose item was "the world that teaches shape
X must carry ≥5% of ITS world's HP in X", and the four shapes it named do sit
there (bubblewrap 5.2% of moving, racer 4.8% of garage, cushion 5.0% of
backyard, boombox 4.8% of moving). But measuring EVERY designed counter shape
shows slime at 2.8% of its best world and 🦆 at 0.6% — so the law holds for four
of six, and shipping it would have meant two exemptions, one of which (slime)
exists only to make the test pass. That is a fence around the residual, not a
law. What the data DOES support, and what this project has now paid for three
times, is reachability: World 4's levels shipped with no card on the grid,
casual/heroic shipped with no selector, and 🦆 spent part of an afternoon fully
built — engine field, art, guide card, guardrails — while sitting in NO wave
table. `AUDIT roster` derives every route a body can enter play (a wave group, a
spawner's drip, a splitter's children, a boss phase's summon, an endless pool or
mini-boss) and fails on any enemy nothing can spawn, and on any type spawned
without a definition. No threshold, no exemptions, and mutation-proven by
deleting the duck's wave groups — which is exactly the state it was in that
morning. **When a proposed law measures as true-for-most, prefer the neighbouring
law that measures as true-for-all.**
**THE MINI-BOSS WAS BUILT, MEASURED, AND CUT — because an HP-preserving swap is
NOT LEAK-preserving, and in a game scored on lives that is the whole ballgame.**
Following the "a level bites iff it has a boss" finding, a 🗑️ Wheelie Bin
(900hp, armor, its own art) was added and dosed at 35% of the last six waves
into all eight flat late levels. Result across 8 seeds: **normal stayed
20,20,20,20,20,20,20,20 on every single one**, and heroic moved in BOTH
directions — L19 15 → **20**, L23 13 → **17**, L26 10 → **13** all got EASIER,
while L27 14 → 12 and L35 9 → 8 got harder.
The mechanism, and it is structural: every body the swap replaces carries
`lives: 1`, so trading ~97 small bodies for ~10 elites removes ~97 potential
leak-lives and adds 10. **Concentration therefore REDUCES a level's total leak
capacity**, which is the opposite of difficulty. To be leak-neutral a 900hp
elite replacing 16hp Spare Keys would need ~56 lives, which is absurd. So the
lever cannot work as a SWAP at any hp — and that also explains why bosses bite:
a boss is ADDITIVE and its wave is explicitly exempt from the ±25% budget
contract, not concentrated inside it. Anything that keeps total wave HP constant
is fighting the wrong quantity.
**Two process errors are worth more than the feature.** (1) **I shipped a stat I
had not measured**: the probe that produced the promising L27 number used
`speed: 0.5`, and the shipped enemy was given `0.42` for flavour afterwards —
slower means longer under the guns, i.e. easier, and it silently undid the
effect. Never adjust the thing between measuring it and shipping it; re-measure
or ship exactly what was measured. (2) **I over-read a single result.** That
earlier L27 "20 → 19 with per-seed variance" was one life on one level, and the
eight-level sweep shows it was inside the noise this swap produces — the honest
reading of one level moving by one life is "no effect detected", not "the lever
works". The enemy was reverted rather than shipped unverified: nothing spawned
it, so `AUDIT roster` would have gone red, and a half-measured balance change is
exactly what got World 4 reverted once already.
**What is still open, with the search space now much smaller:** making a
non-boss level cost lives needs an ADDITIVE, budget-exempt body with a leak toll
in the 2-6 range (the Piñata is 400hp/2, bosses are 6-10) — i.e. a real
mini-boss WAVE, not a re-mix of an existing one. That is a deliberate content
pass with its own budget-audit exemption, and it should be measured on lives
LOST rather than lives remaining.
**TWO REAL-PLAY BUGS, AND BOTH GUARDRAILS PASSED A MUTATION BEFORE THEY WORKED —
which is the actual lesson of the pass.** (1) **"Sound on/off in the menu also
turned off music."** True, and it was TWO couplings, not one: `startMusic()` and
its per-note `step()` both early-returned on `!save.settings.sfx`, AND the Sounds
handler itself called `stopMusic()`. One button silenced two things the menu
offers as separate switches. Fixed with one owner (`audioMuted`/`sfxOn`) and the
semantics the menu implies — the global 🔇 is the master and silences everything;
Sounds and Music are then independent, and neither may silence the other.
Deliberate asymmetry worth keeping: Music OFF ends the loop, while the global
mute only skips the NOTE, so unmuting resumes mid-phrase instead of needing the
toggle cycled — which is exactly why there is no `musicOn()` twin to `sfxOn()`,
because collapsing them would have made a mute kill the loop for good. **The
guardrail needed two attempts:** driving Sounds off while music was already
playing does NOT re-enter `startMusic()`, so reverting that gate left the running
loop alive and the test stayed green. It now also toggles music off and on again
while Sounds is off — the real user path, and a second, separate gate.
(2) **"The gear symbol kept jumping between the top line and the line below."**
Measured: at 390×844 the ⚙️ sat at y=8 with 0 gold and y=37 once gold grew — a
29px jump mid-run — and at 375×667 the bar went to THREE rows. `.td-hud` is a
wrapping flex row, so every widening readout could push the button onto the next
line under the player's thumb, and making it a 44px button had made it a bigger
target for the reflow to move. The HUD needs 347px against 180px per row at
390px, so it MUST wrap: the fix is that it now wraps IDENTICALLY every time —
tabular numerals plus a reserved width for each readout's worst case, in `em` so
the reservation shrinks with the font at the narrow breakpoint. Fitting two rows
rather than three needed the wave label under 117px, so it sits at 0.88em (132 →
116px) and keeps the word "wave" instead of being cut to a bare "14-15/15". Every
viewport is now stable AND no taller than before (390: 73 → 71, 320: 96 → 90).
A third defect surfaced while fixing it, and it is the allowlist class: `.td-hud`
sat on the flex-gap allowlist justified as "readouts — not tappable", and **that
justification stopped being true the moment the ⚙️ became a button** — Safari 14
DROPS flex gap, so on the real device the button sat flush against the gold while
every headless measurement showed 8px. The allowlist is exactly what stopped the
guardrail seeing it. It uses child margins now and the entry is gone. Two things
came out of that: the `* + *` pattern is not gap-equivalent on a WRAPPING row
(the first item of each wrapped row also takes the margin, so it eats 8px of row
width and wraps a whole row earlier — 4px restores the two-row layout), and the
71px I had measured with `gap` was **a Chromium-only number that never existed on
Jon's phone**. When you touch a rule on that allowlist, re-read its reason.
**Its guardrail passed the mutation THREE times before it worked**, and the
reason is the one to remember: the test never navigated to the play screen, so
`getBoundingClientRect().top` returned 0 at every viewport — and **four zeros
look exactly like four identical positions**. A hidden element is the classic
degenerate reading, so the test now fails explicitly on `y <= 0` rather than
scoring it as "stable". Only after that did it catch the mutation, and it catches
it at exactly the two reported viewports.
**THE DIFFICULTY QUESTION IS ANSWERED, AND THE ANSWER IS ONE SENTENCE: in this
engine a level costs lives IF AND ONLY IF IT HAS A BOSS.** Measured with the
shipped oracle over all 36 levels × 8 seeds on normal: **11 levels sit at a flat
median 20 on every seed** (L1, L2, L7, L19, L22, L23, L25, L26, L27, L31, L35 —
World 7 and World 9 are formalities apart from their bosses), and every one of
the nine boss levels lands in 7-17. The correlation is not HP, not pads, not
gold, and the cleanest proof is a single pair: **L31 carries 5,997 HP per pad and
finishes flat 20; L32 carries 5,066 and costs 6 lives.** L12 at 3,220 HP/pad
costs 13. The only structural difference is the boss.
That retro-explains every refuted lever in this file — flier share, backbone
stat shape, HP piles, gold, budget base, lane length, side-door dose — because
all of them are *more or different CROWD*, and a crowd of ordinary bodies
provably cannot beat a completed board at any budget the ±25% contract allows.
It is why they each measured zero. **A NEW refutation was added on the same
axis and is worth recording so nobody retries it: CONCENTRATION does not work
either.** Converting up to 50% of a flat level's late-wave HP into 400hp
Piñatas — the heaviest non-boss body in the game — moved L27's normal by
literally nothing (20 on all 8 seeds at every fraction). The fixture was
verified rather than trusted: wave 14 really did go from 276 small bodies to
139 small + 11 Piñatas at 0.0% HP drift. 400hp is simply not boss scale.
**What LOOKED like it moved it was a boss-scale body — and the follow-up
eight-level sweep REFUTED that; see the mini-boss entry above, which supersedes
this paragraph.** Injecting a synthetic elite
HP-preservingly into L27's last six waves (`tools/td-elite.js`, kept so this is
re-runnable): at 900hp / 35% normal goes 20 → **19 with genuine per-seed variance
(19,19,19,19,19,20,19,19)** and heroic 14 → 9 with no losses; at 1300hp normal is
19 but heroic loses a seed; at 1800hp normal is 18 and heroic collapses to 6.
So the step function this file documents six times over is now located to within
400hp of elite: **the window where normal grades and heroic survives is narrow,
and the prize inside it is one life.** That is the honest size of the effect, and
it is why no wave-table pass was shipped from this investigation — a graded
normal needs a real mini-boss per late world (art, a guide card, a distinct
silhouette, per-level dosing), which is a content project on the scale of a
world, not a re-tune. Recorded, measured, and left as a decision rather than
half-built.
**GOLD STOPPED BEING A RESOURCE, and the cause was not income — it was that the
board RUNS OUT OF THINGS TO BUY.** Reported from real play: *"on normal I end
levels with thousands of extra money even when I have max level towers on every
spot."* The shipped oracle cannot see this at all, because it deliberately stops
at tier 3 and never buys a tier-4 branch — it is still spending when a real
player has finished. A player-shaped probe (`tools/td-gold.js`: fill every pad →
tier 3 → take a branch) measured it exactly: **21 of 36 levels reach a board
with literally nothing left to purchase, on average 2.2 waves before the level
ends** (up to 4), leaving **2,770 gold unspent on average and 8,138 at worst**
(L31). Worlds 1-3 never hit it — this is a World-5-onward problem, which is why
the report said "on normal at least". Two things then constrained the fix, both
measured before anything was built. **Stars are scored purely on lives
(`[[18,3],[10,2],[1,1]]`), so the obvious sink — spend gold to repair the door —
would literally be BUYING STARS**; ruled out on that basis alone. And **cutting
income is not a difficulty lever**: in a bounty sweep the lives column came out
NON-MONOTONIC (L31: 4 → 14 → 20 → 6 → 20), which is the greedy probe's build
ORDER changing, not a signal — the "a pad ordering is part of the oracle" trap,
this time inside my own instrument. Only the economy columns from that sweep are
trustworthy, and they say a 0.7× bounty removes the dead stretch entirely.
**The fix is an EXCHANGE: tap the ⚙️ in the HUD to buy one more Toy Energy for
450🪙, once per wave.** It re-couples the two currencies so surplus buys options,
and it is safe for exactly one reason — the PER-WAVE CAP. Phase 3 made energy a
flat per-wave budget precisely because a per-kill grant scales with wave size;
capping purchases keeps that flatness by construction. Measured against the
shipped ability-abuse fixture, buying every ⚙️ available on EVERY wave and
spamming all five powers: **all nine boss finales come out at IDENTICAL medians
to the no-exchange baseline**, and several per-seed values are LOWER, because
energy bought is gold not spent on towers — the trade has a real cost, which is
what makes it a decision. The guardrail is falsifiable and was proven so: at
`chargeBuyMax` 6 / base 100, **L16's median jumps 8 → 20** — the finale erased on
5 of 8 seeds. Two implementation notes. `state.chargeBought` needs NO checkpoint
field, because a checkpoint is a wave boundary where it is always 0 (the
`waveIdx`/`sentIdx` reasoning). And a shipped guardrail caught the first cut
honestly: **`mods.charge` must have exactly ONE read site**, and computing the
bank ceiling inside the exchange made a second — so the cap became one
`chargeCap()` over a single `const chargeBonus = mods.charge`, which is the shape
that keeps a 🔋 Spare Battery applying to the grant AND the exchange rather than
one of them.
**THE APP'S SOUND WAS A BEEPER, and every defect was in the ONE shared primitive
— so every fix reaches all 240 games and the fort at once.** Four things, each
measured rather than described. (1) **Every voice connected straight to
`destination`**, so simultaneous cues simply SUM with no headroom and no
limiter. That is not hypothetical: `die` fires once per kill with no throttle, so
a mortar splash that clears a group asks for a dozen voices in a tick on top of
`splash` and `shoot` — measured, an uncapped 50-cue burst creates **100
oscillators**. There is now a master bus with a compressor as a soft limiter, and
a guardrail asserts exactly ONE node reaches the speaker. (2) **A voice cap (12)
that DROPS rather than queues** — a late note is worse than no note. The second
half is the one that is easy to get wrong and is tested separately: a cap that
leaked would make the game go permanently silent, which is far worse than the
pile-up it prevents, so `done` is idempotent and fired by whichever of `onended`
or a timer arrives first. "It caps" and "it frees" are two different tests — the
corpse-fx lesson, in the audio layer. (3) **A fixed 20ms attack for every cue**,
so a 30ms tick spent two thirds of its life attacking and had no snap; and the
envelope ramped to 0.0008 and then stopped the oscillator, which clicks. Attack
now scales with the note and the tail ramps to true silence. (4) **The music was
ONE bare sine walking an 8-note scale up and back, forever**, looping every 3.4
seconds — now a 4-bar phrase over a walking bass with an A/B section, still the
setTimeout composer, still mute-gated and off by default.
**And the audio work found a FIXTURE bug that presented exactly like a product
bug.** The e2e suite stubs `AudioContext` to model iOS faithfully, but its
`GainNode` had only `setValueAtTime` and `exponentialRampToValueAtTime` — so the
moment the shared envelope used `linearRampToValueAtTime` (original Web Audio,
2013, present in every browser including Josh's iOS 14.2 iPad) every note in the
app threw inside `tone()`'s try/catch and went silent, and **two shipped tests
timed out**. Suspect the fixture: a stub less capable than every real browser
invents failures. It now models the real node graph — and records what each node
connects to, which is what makes the limiter claim testable at all.
**The TOWERS were four coloured balls, and the honest way to find that out was
to MEASURE the silhouette rather than describe it.** Rendered at the 27px cell a
phone actually uses, the three SHOOTING lines were all discs — circularity 0.669
(dart), 0.687 (mortar), 0.698 (fan) against camp's 0.395 triangle — and
dart-vs-fan at tier 1 scored **0.301** on a 10×10 occupancy grid, the tightest
cross-line pair in the game. So at the instant you place a tower, exactly when
you most need to know what you bought, colour was carrying the whole read and
form none of it; and the named fiction ("Pea Shooter", "Crate Cannon", "Army
Guys") appeared nowhere on the screen — not a pea, not a plank, not a soldier.
Rebuilt around a shared `TOY` material kit (sheen · bolt · tape · plank · tube)
so the fix is a MATERIAL language a fifth line inherits rather than four one-off
redraws: a blaster with orange-tipped barrels and a visible pea hopper, a wooden
crate with grain and corner brackets, a real desk fan on a neck with a spoked
guard cage, a tent with guy ropes and a sentry. Tightest pair **0.301 → 0.402**,
every pair improved, fan circularity 0.698 → 0.131. Five things worth keeping.
(1) **The functional part has to protrude far enough to EXIST** — the dart's
barrels cleared its dome by 0.17 cells (≈5px) and the mortar's muzzle by 0.07
(≈2px), which is why they read as ears and a bump rather than as guns. (2) **A
per-sprite ink budget is consumed in DRAW ORDER, so decoration drawn first
silently steals the body's contour** — and it had: `towerPlinth`'s six 0.028u
skirt bolts (0.75px, so inking them buys literally nothing) plus its fill and
ring spent all four pens BEFORE the tower was drawn, which is the entire measured
slide from edgeMed 23 at tier 1, where there is no plinth at all, to 68 at tier
3. The bolts are `noInk()` now. Note the diagnosis went wrong first: the trend
was visible early and I blamed the barrels, which was plausible and false — the
4/6/8-pens-identical result is what named the real consumer. (3) **The two
halves of that budget cost wildly different amounts and are now separate** — the
dark pen is one stroke of an already-built path; the lit edge does a `clip()`,
which this file already measures as nearly the whole 1.82 ms it costs at the
enemy peak. So towers get 9 pens and the lit budget deliberately does NOT grow.
9 is measured, not chosen: against a 40-pen reference every line saturates at 8
and the Minigun (5 spinning barrels + body + plinth) needs the 9th. (4) **Detail
that mushes at the real cell size must not be load-bearing** — the camp's first
cut fielded three army men at 0.052u wide, i.e. **1.4px**, which is noise; one
sentry at 0.10u × 0.26u in a LIGHT khaki (a dark-green man on a dark-green tent
is invisible at any size) is the smallest thing that still reads as a person.
(5) **Two guardrails, both mutation-proven against the art they replaced**: a
cross-LINE distinctness check (the enemy near-twin law applied to towers,
threshold 0.33 — above the measured 0.301 and below the rebuilt minimum, and
derived from `DATA.TOWERS` so a fifth line inherits it), and a SATURATION check
that is the only falsifiable form of "the budget covers the body" — a fixed
darkness threshold cannot catch it, because 68 is a perfectly dark edge in
absolute terms, so the test asserts instead that handing out MORE pens changes
nothing. Un-noInk the skirt bolts and 12 variants go red. The shipped perf
guardrail also grew teeth it was missing: it built tier-1 darts only, so a cost
living in the fan or camp art was invisible to it; it builds a tier-3 MIX now.
**Two process lessons, both expensive.** First, **the whole diagnosis was
initially made against a rolled-back clone** — the container had reset the repo
to a stale commit, so the "towers have no ink line" premise was simply false on
`main` (it had shipped two commits earlier), and the contact sheet I reasoned
from was a picture of code that no longer existed. Check `git log` against
`origin/main` before believing anything you measure here. Second, **a
single-burst perf A/B is worthless**: the first measurement said the tower pass
cost 6.38 ms and I nearly reverted the whole pass over it, but the no-tower
control swung 4.30→9.31 ms run to run, i.e. the noise was larger than the signal.
Interleaving the two conditions across 25 short reps and comparing MEDIANS gives
the real number — **1.17 → 1.93 ms**, a frame of 5.34 → 6.25 ms against 16.7 —
and it scales with tower count (≤14), not with enemies. And a third, cheap one:
**never `git checkout <file>` to undo a mutation test on a file with uncommitted
work** — it discarded the entire rebuild in one command. Copy the file first, or
reverse exactly the patch you applied.
**The iOS-14.2 floor has a CANVAS layer, and it had no guardrail** — the CSS
floor laws (no flex-gap for spacing, no `inset:`, `dvh` needs a `vh` twin, no
bare `aspect-ratio`) are all enforced, but the 2D context has the same shape of
trap: `ctx.roundRect` is Safari **16**, `ctx.filter` is Safari **17** *and* this
project's documented rasterization cliff, and both are present in Chromium and in
CI's modern WebKit — so a bare call ships green and misbehaves on the one device
that matters. Now scanned (derived from the same `SCRIPTS` list as the emoji
check), requiring a same-line feature check with a fallback, exactly as the ink
line's own `canInk` probe already does for the fillStyle accessor. The dart's
body uses `roundRect`, so the fallback was rendered on a simulated Safari 14
(`delete CanvasRenderingContext2D.prototype.roundRect`) rather than assumed: a
sharp-cornered box, still plainly a blaster, no page errors.
**And writing that guardrail immediately re-taught the oldest lesson here: a
guard check scoped to the FILE is unfalsifiable the moment one call site is
guarded.** The first cut asked "is `roundRect` tested anywhere in this source?",
and `td-render.js` already had two ternary-guarded uses — so deleting the guard
from a THIRD stayed green, and the test could only ever have caught a file where
*every* use was bare. It checks per call site now, and names the line. The only
reason this was found is that the mutation was actually run; a guardrail you did
not try to break is a guardrail you have not tested.
**The build menu's tower list is DERIVED now** (`Object.keys(DATA.TOWERS)`,
was `["dart","mortar","fan","camp"]`) — the counting law applied to the one
surface a new tower line has to appear on. `.td-buildmenu` is a wrapping
2-column grid so a 5th button costs no layout, unlike the ability strip's hard
four. The guardrail injects a fixture line at runtime and asserts the menu
GROWS, so it is self-proving rather than relying on someone remembering to
mutate it: on the old literal it reports "saw 4 of 5". (A 5th line is still
recorded as NO — neither oracle plan would buy one, so it would ship provably
untested as a feature — but it must not ALSO need a code hunt to become
buyable.)
**A `shield` is an anti-FAN buffer and NOTHING else — and TWO design documents
were built on the opposite belief, so this one is worth more than the enemy it
killed.** `computeHit` moves damage into a shield on exactly one condition,
`dmgType === "zap"`, and every non-Fan source in the game is `bonk`. So for a
dart, a mortar, a soldier or an ability, a shielded body is EXACTLY its hp: it
dies at exactly the same moment a shieldless clone would. Measured through the
real firing path — dart, mortar and camp kill times are **identical to two
decimals at `shieldRegen` 0 and 34**, while a tier-1 Fan goes from 40s to
**never** at any regen ≥6. Three things follow, and each closed an open item.
(1) **🥫 Pantry Can is CUT.** Its spec identity was a fast-resealing shield sold
as a "you must go TALL, not wide" check; the measurement says a fast reseal only
ever means "the Fan cannot hurt me", which is 🦆 Rubber Duck's already-recorded
**zero-lives** role wearing a tin hat. (2) **The wave-budget audit still weighs a
group by plain `hp`, deliberately.** The spec's critique claimed the curve was
"~35% blind" to shielded groups and I started fixing exactly that — re-anchoring
three levels' `budgetBase` and re-authoring two waves — before measuring the
premise. Counting shield as budget HP would OVER-count for three of the four
lines and turn the typo guard into the false-positive machine this repo refuses
to ship; the change was reverted whole. (3) The fact is now pinned by a guardrail
that tests `computeHit`, not `dealDamage` — dealDamage takes hpDmg and shieldDmg
as separate arguments and spends whatever it is handed, so a test that passes it
a shieldDmg proves only that arithmetic works. It also asserts every non-Fan tier
is `bonk`, or the clause it checks would be guarding nothing. Meta-lesson: **a
critique is a claim, not a measurement** — the correction was right about the
STACKING and wrong about the arithmetic, and only driving the engine separated
them.
**🛢️ Oil Drum ships as the roster's first POSITIONAL threat: it spills where it
DIES.** Every recent shape was a resist and the resists are exhausted — the
matrix has one reduction per damage family, and two of the last three measured at
zero lives. So the drum carries no resist at all: `spill` pushes a `state.puddles`
entry (the Sticky Floor's own array) carrying `hurry` instead of `slow`, from the
ONE idempotent `killEnemy`, and `effSpeed` already had exactly one place that
reads a hurry flag (the Boom Box's) — **one write, zero new read sites**, so it
composes with zones, enrage, boss phases and the music for free. Killing drums in
front of your best guns speeds the rest of the wave through your own kill zone,
so *where* you break them is the decision. Two things to keep. **The `|| 0` in
that write is load-bearing:** unlike `hurryTick`, which plain-assigns, this READS
the flag before writing it, and any comparison against an `undefined` field is
false — so a body constructed without `hurriedUntil` was silently never oiled
while every number in the engine still looked right. Exactly the zone with no
`mult` and the wave group with no `delay`: a field one short must degrade, not
disable. And **the drum measures outcome-NEUTRAL on the shipped oracle** (L17
normal 19 on all 8 seeds before and after; heroic median 11 → 12, flat) — but for
a structurally different reason than 🦆. 🦆 was neutral because the Fan is not a
damage line, so there was no board for its counter to bite. The drum is neutral
because **the auto-solver has no positional agency**: it builds and fires and can
never choose to break a drum early. The mechanic is real (a sock crossing the
slick covers a measured 1.45× the ground), it is simply invisible to a solver
that makes no positional choices — which is also what makes it safe to ship, since
an outcome-neutral body cannot break a tuned level. Dosed HP-preservingly into
L17 "Oil Slick" (w7 and w11, racer→drum, ±2.3%), so the ±25% budget contract and
the ≥70%-backbone rule are untouched. **When the resist matrix is full, the next
enemy has to change a DECISION, not a number.**
**🧱 BARRICADE — built, measured, CUT. The fifth gimmick shape does not work, and
the arithmetic says it never can.** `PLAN_GIMMICKS §6.4` deferred a destructible
obstacle for "needing a second engine read site"; it does not need one — a crate
is a SOLDIER the level owns rather than a camp, so a `fixture` flag lets it
inherit block / hold / melee-trade / free-on-death / disengage-from-hidden
untouched, and the entire enemy side of the engine stays as it is. It was built
that way and it works. It was cut anyway, for two measured reasons. (1) **Its
identity is unreachable.** The design is a chokepoint that ERODES across a run —
the only mechanic in the game whose effect changes as you play. But it holds
`blocks` bodies at once and each swings for ~5 damage a second, so it takes ~15
dps against a queue of 20-100, and it is consumed **in wave 1-2 at every
authorable hp — including 1800**. Lasting eight waves needs ~7000 hp, which is a
permanent free chokepoint, i.e. the failure mode rather than the feature. There
is no hp that is both durable and erodable. (2) **It fails this project's own bar
for a gimmick: it changes nothing the player DECIDES.** Mud, conveyor, cover,
power pad, side door and lever each change where you build or when you act; a
crate at an authored spot that is gone by wave 2 cannot be moved, protected or
traded. Its only measurable effect was L9 normal median 16 → 18, i.e. softening a
level that is not a formality and does not need it. Both halves recorded so the
next author does not rebuild it.
**And the same afternoon reproduced the World-4 revert IN MINIATURE, which is the
more useful lesson.** The first barricade sweep was a scratch script with a
hand-typed MIXED plan — same four lines, DIFFERENT pad ordering. It reported L29
heroic 20/20 where the shipped oracle reports median 8, and L31 a total loss on
all 8 seeds where the oracle reports 13; it also claimed the crate was worth +6
heroic lives and moved nothing on normal. Every one of those numbers was fiction,
and the tell was that L31 "unwinnable on heroic" contradicts a shipped guardrail.
**A pad ORDERING is part of the oracle.** Two smaller instrument bugs rode along:
the erosion probe called `callWave()` with no towers, so every enemy survived to
chew the crate and it always read "dies wave 1" — it was measuring a board that
does not exist; and an `if (hp === 0) break` meant only the baseline row ever
ran. Three fixture bugs in one sweep, each of which looked exactly like a result.
The rule that would have caught all three on sight: **a measurement that does not
go through the shipped `best()` is not a measurement of this game** — which is
why the sweep was rewritten as a `--barricade` flag inside `tools/td-sim.js`
before being trusted, and why it was removed with the feature rather than left
behind as an instrument for something that no longer exists.
**The L8/L16 QUANTIZED-FINALE item is closed: L16 had already fixed itself, L8
was fixed by a 400-hp move, and the reason the obvious lever fails is now
measured.** Re-measuring the two levels this file records as boss-quantized found
**L16 is no longer one** — the earlier Tickmaster toll cut (10 → 8) did its job,
and it now reads normal 10,6,20,15,20,17,14,17 (a genuine 6-to-20 spread) and
heroic 4-8. L8 was the live one, and the tell was not a bad median but **ZERO
VARIANCE**: heroic finished on exactly 10 lives on all 8 seeds, normal on 10-11,
because the 8000-hp Vacuum King reached the door on every seed and every build.
The level reduced to a guaranteed 8-life tax you could not influence. Three
things came out of the sweep (`node tools/td-sim.js 8 --boss`, added beside
`--lever` so it is repeatable). (1) **The leak TOLL cannot de-quantize anything —
it is a pure offset.** Heroic came out at exactly `20 − toll − 2` for every
toll ∈ {4,6,8} at every hp ∈ {4800…8000}: 14, 12, 10, each with spread 0. A toll
change moves the constant and never creates variance, so it is a readability
knob, not a tension knob. (2) **The hp cliff is real but NARROW, and there is a
graded band inside it.** On normal: 7200 → the boss dies on all 8 seeds (18,18,…
a formality); 7400 → it leaks on 2 of 8; **7600 → 6 of 8, spread 10..18**; 8000 →
8 of 8. So 7600 is the only value where both outcomes genuinely happen, and it is
what ships — holding the King cleanly is possible for the first time. This is the
first time a graded boss band has been FOUND in this engine; the L16 sweep that
concluded "the boss's hp cannot grade that finale" swept in steps of 100 across
3200-3500 and the L8 band turned out to be ~200 wide at ~7500, so the lesson is
that the cliff has structure and you have to sweep INTO it, not that it is
always sheer. (3) **Heroic is structurally ungradable here and is left alone** —
at ×1.30 hp the King leaks at every value tested down to 4800, so heroic stays a
flat 10 (in the 5-17 audit band, and a real fight). Recording that half honestly
matters: the fix is a normal-difficulty fix, not a general one. Method note for
the next finale: **judge a boss on SPREAD, not median** — a sweep judged on
medians alone happily picks a perfectly flat setting, which is exactly the defect
being fixed, so `--boss` prints `min..max` on every row.
**The BACKBONE STAT-SHAPE lever was the last untried difficulty knob, and it is
NOT a lever — measured, refuted, closed.** `PLAN_EXPANSION.md` carried it as the
biggest thing left on the table: *"at 0.00% budget drift, two pure vanilla swaps
took L21 heroic from median 13 to a LOSS and L17 from 10 to 5 while normal barely
moved"*, tagged `[unverified]` and deferred as "a real and large lever — and a
cliff". It was never run through the shipped oracle. Every world's ground
backbone is the same four shapes wearing local names (slot 0 a 34hp/0.8 body,
slot 1 the 90hp/0.6 armored Knight, slot 2 the 60hp/0.7 splitter Blob, slot 3 a
16hp/1.7 swarm body), so substituting one slot for another and rescaling the
count is a pure change of what a wave IS at a constant budget — which is why it
looked like the one knob left after gold, budget base, lane length and side-door
dose had all failed. Driven properly (`--swap`, now beside `--lever` and `--boss`)
over **three directions × five levels at ~0% drift**: L21 heroic 12 → **12,
identical**; L17 12 → 13. And the decisive half — **normal never moved once.**
L23, L30 and L31, the three levels this file records as pinned at 20/20 and
immovable, stayed at exactly 20,20,20,20 whether their even-wave primary became
the swarm body or the armored Knight, while heroic wandered ±3 in **both**
directions (L30 came out *easier* under both supposedly-harder swaps). That is
threshold domination reproduced a **fifth** time, and it settles the shape of
this engine: the backbone's stat profile is a FLAVOUR axis — it is what makes the
Garage's crowd feel unlike Moving Day's — and it is not a difficulty axis. Do not
reach for it to make a level harder. The generalizable rule is the one this
session paid for twice: **a claim carrying `[unverified]` is a hypothesis, and in
this repo the cheapest way to close one is to build the flag that measures it** —
`--swap` costs nothing to keep (pure data manipulation over shipped levels, no
engine support), so the next author who doubts this can re-run it in one command
instead of re-deriving it.

**The star tree grew to 123⭐ / 35 nodes, which UNBLOCKS a ninth world — and it
grew entirely by BREADTH, as this file's own rule demands.** The ceiling derives
as `LEVELS.length * 3`, so 36 levels means 108⭐ and the "the tree must cost more
than you can earn" guardrail goes red at 105. Five new KINDS (never ranks — a
rank is raw power, and three individual Firepower ranks are already recorded as
each erasing a boss finale on their own; a kind is a choice, and under a 6-slot
pack only choices make the tree interesting): ⏱️ **Fast Hands** (powers return
20% sooner — the ONE `abilityCd` stamp), 🎯 **Close Quarters** (the Mortar's dead
zone shrinks 40% — the only `candidates()` call in the engine that passes a
non-zero minimum, so exactly one read site, and it finally answers the
structural weakness that makes mortar-mono lose at any damage), 🔧 **Handyman**
(tier 1-3 upgrades −10%, deliberately NOT branches, which Bulk Deal already
owns — two nodes discounting the same purchase would stack into a cheaper board
than either was priced for), 🔌 **Warmed Up** (the ⚙️ bank starts full, so wave 1
can afford a power), 🛬 **Soft Landing** (a leak costs 2 fewer stickers, floored
at 1). Margin at 36 levels: **15⭐**. Two lessons came out of it, and the second
is the sharper one. (1) **The "empty tree is exactly vanilla" `deepEqual` is a
whole-SHAPE assertion, and that is what makes it valuable** — it went red the
moment five keys landed in `metaMods` without declaring what "off" means, which
is precisely the dead-default class this repo keeps finding. Adding a mod without
its identity value cannot ship. (2) **A guard that cannot change an outcome is
dead code whose test cannot fail, and mutation testing is how you find out.**
Soft Landing was first written `rawToll > 1 ? Math.max(1, rawToll - 2) : rawToll`
with an assertion that a 1-life sock is untouched — and the mutation that deletes
the `> 1` guard PASSED, because `Math.max(1, 1 - 2)` is already 1. The guard was
provably redundant and the assertion provably vacuous. Both are gone: the clamp
alone is the whole mechanic, and the test now asserts the VALUE (`a 1-life leak
costs exactly 1`), which fails the moment the floor is removed. Four of the five
nodes were caught by their first mutation; the fifth taught more than the other
four together.

**WORLD 9 — 🏭 The Toy Works (L33-L36) SHIPPED, and the guardrails wrote the
patch list.** The loop closes: the step after ♻️ The Sort Line is the factory
that melts you down and moulds the next toy. Three backbone skins (🧩 Reject
Piece, 🟠 Resin Pellet, 🥏 Flying Offcut), the 🗜️ Stamping Press boss, its own
`mould` floor pattern and `plates` road, a 9th endless arena, and the world's one
fork+lever on L35. Nothing was typed by hand: lanes and pads came out of
`W9=1 tools/td-map-search.js`, waves out of `tools/td-wave-gen.js`. **The first
full run then failed FIVE guardrails, and every one was a real omission** — no
achievement badge for the new boss (and separately, no wiring that awards it —
two different tests, which is the point), L33/L34 with no declared hook, L36's
escort asking the identical question to L16's (`armor,flier`), and L35 shipping a
fork with no measured thin-board cap. That is the "make the tests able to fail"
investment paying rent: a new world cannot ship half-wired.
Four measurements are worth keeping. (1) **The 8-seed rule earned its keep
again**: at the default 4 seeds L36 looked fine, and at 8 it **LOST on heroic
seed 1** — the L30 defect exactly. Its waves came down (budgetBase 1150 → 1050,
regenerated, not hand-trimmed) and it now reads normal median 14 (10-14, graded)
and heroic 8 (5-9, no losses). (2) **On this world gold is a CLIFF, not a
slope** — L33 measured normal 12 at 900 gold, 19 at 1100, and a flat 20 at 1300
and 1500, with heroic LOST on every seed at 900. Threshold domination reproduced
a sixth time, now on a brand-new map: there is no setting that makes normal
*graded*, so World 9 ships where every gate passes with a tense heroic (L33 16,
L34 13, L35 9) and a flat-20 normal, exactly as the Garage did. (3) **Gold and
boss hp are both INERT on a finale whose pressure is its wave table** — L36 read
identically at 1900/2100/2300 gold and at 3800/4400/5000 boss hp; only the waves
moved it. Sweep the knob you think is responsible before you turn it. (4) **A
lever must be measured, not assumed**: L35's is worth 6 lives at a 10-pad board
(short won 13 → with-lever 19) but has NO phase flip at any board size, so it
joins L3 and L10 as a magnitude lever and the population claim carries the
"levers are not cosmetic" burden.
Two art traps, both of which the guardrails caught and neither of which reading
the code would have: **a boss must draw at `R = r * bossScale(e, …)`, and there
are only three call sites** — the Stamping Press was drawn at plain `r`, i.e.
grunt radius, and painted 312 ink pixels against an ordinary toy's 434. And
**the near-twin metric is driven by SILHOUETTE and coverage far more than hue**:
the shipped roster's closest pairs sit at 1.52-1.67 against a 1.2 floor, so a
magenta Reject Piece still read as the tan Grease Rag (0.91) purely because both
were wide low blobs. Re-colouring did nothing; making it tall and narrow with a
bright top face and a deep socket fixed it. The way to tell those two cases
apart is the experiment that settles it in one run: replace the sprite with a
plain white circle and see whether the reported pair changes — it did, which
proved the branch was running and the shape was the problem.
**A post-World-9 test pass found that the "force every boss phase" law was
honoured by ONE HAND-WRITTEN TEST PER BOSS — so the list itself was the hole, and
three finales had no test at all.** CLAUDE.md already records the law (a solver
may never drop a boss into its low bands, so a `disable`/`spawn`/`dash` kit can
ship dead-untested), and it had been obeyed for the Static, the Tickmaster, the
Titan and the Moving Van by writing a bespoke test each time. The consequence was
exactly the recurring class: **`housedog` (W7), `bigmagnet` — the CAMPAIGN finale
— and `stamper` (W9) appear NOWHERE in the engine suite**, each carrying a full
3-band kit, and every future world's boss would escape the same way. `AUDIT boss
kits` now derives its subjects from `DATA.ENEMIES` (`boss: true`) and drives every
band plus `stomp`/`suck`/`enrage`/`spawner`, so boss #10 is covered the moment it
declares itself; the bespoke tests stay (they assert extras like the van's capped
load). Measured result: **all 9 kits are live** — this was a coverage defect, not
a behaviour one. The sweep costs under a second, and it carries a
`effectsProven >= 25` floor so a refactor that stopped bosses declaring kits
cannot make it pass by finding nothing to check. **Three fixture traps each
produced a false "it never fires" while the engine was correct**, and all three
are the documented "suspect the FIXTURE before the balance" shape: `upTo`
DESCENDS and `activePhase` keeps the LAST match, so band *i* covers
`(phases[i+1].upTo, phases[i].upTo]` — the NEXT entry is the floor, and using the
previous one puts every probe in band 0 where nothing is declared; `enrage` is
read in `effSpeed` and never sets `e.speedMult`, so it must be measured as the
boss covering more ground, not as a flag; and `stomp` hits soldiers within a
radius OF THE BOSS, so the squad has to be parked on it. **The same pass found the
one commit this session that changed shipped balance with no test at all** — the
L8 de-quantization (Vacuum King 8000 → 7600) — and writing its guardrail produced
a REFUTATION worth more than the test: the natural general law, "a boss finale
must be holdable cleanly on at least one seed", measures FALSE for six of the nine
finales (L4/L12/L20/L24/L28/L32/L36 all leak their boss on 8 of 8 seeds under the
shipped oracle; only L16 at 7/8 joins L8 at 2/8). Six exemptions is a fence around
the residual, not a law. The neighbouring universal property — every finale has a
lives spread ≥ 1 — is too WEAK to catch it, because pre-fix L8 finished 10-11 on
normal, a spread of exactly 1. So the guardrail is deliberately L8-scoped and
pins the band from BOTH sides (holdable on ≥1 seed, leaks on ≥1 seed),
mutation-proven at 8000 → "reached the door on 8/8" and at 7200 → "never got
through on any seed". Lesson: when a tuned value sits in a narrow band, pin the
band, not a median — and when a proposed law measures true-for-most, prefer the
neighbouring law that measures true-for-all *only if it can still fail on the
defect you just fixed*.
**And the pass found a REAL defect in the same session's own new code: a 📻 Boom
Box DOWNGRADED a 🛢️ oil slick, because `effSpeed` being the single READ is not
enough once a field has two WRITERS.** CLAUDE.md already records the read-side
law — "effSpeed is already the single place a speed is decided, so zones, enrage,
boss phases and this all compose instead of each growing their own speed
computation" — and the Oil Drum's slick honoured it by writing the Boom Box's own
`hurriedMult` rather than inventing a second field. But the two WRITERS shipped
with different policies: the puddle took the MAX, `hurryTick` plain-assigned, and
`hurryTick` runs LAST in the tick. So a Boom Box walking into a ×1.45 slick pulled
the enemy DOWN to ×1.35 — measured at 2.308 → 2.151 cells per 60 ticks, a 6.8%
loss, with the stronger effect silently erased by the weaker. It is reachable, not
theoretical: **L34 and L36 both carry a drum AND a boom box**, and ⏩ RUSH puts two
waves on the field at once. Fixed with `applyHurry(e, mult, ticks)` — the exact
`applySlow` shape, strongest-wins, one owner — and guardrailed in two halves: a
behavioural test that the pair composes to 1.45 (mutation-proven against BOTH the
shipped unconditional assign and a last-writer-wins `applyHurry`) and a structural
scan asserting `.hurriedMult =` appears exactly ONCE in the engine, so a third
source cannot re-open it. Shipped balance is untouched — L34/L36 re-sim
byte-identically, because the auto-solver never rushes and so never overlaps the
two sources, which is also exactly why no existing test could see it. **The
general rule: "one read site" is a composition guarantee only while there is also
one WRITE site. When a second source starts writing a shared field, give it an
owner the same day.**
**A six-dimension PLAYABILITY / ART / QUALITY audit of the fort found ONE real
defect and five clean results — and the clean results are the deliverable,
because each one closes a question that would otherwise be re-asked.** The
defect: **the "every `@keyframes` must have a reduced-motion off switch" law read
`styles/main.css` ONLY**, so `td.css`'s four fort animations were never audited
by the very rule written to stop an animation shipping ungated. All four happen
to comply, so this was latent — but a FIFTH fort animation could ship with no off
switch and nothing would notice. Fifth instance of the class (flex-gap guarded
only main.css · the VS16 scan hand-listed nine files · live-verify probed only
index.html · FIELD_TRAIT hand-listed twelve fields · the overlay audit
hand-listed six dialogs). **Widening it exposed a second bug in the check
itself**: it took `css.slice(indexOf("@media (prefers-reduced-motion)"))`, which
works for main.css only because that file keeps ONE block at the end — td.css
puts an off switch inline beside each animation, so a slice-to-end swallows the
rest of the file and matches the animation's own NORMAL rule, making the check
unable to fail. Proven: deleting `td-toastpop`'s off switch left the slice
version green. It now extracts the CONTENTS of every reduced-motion at-rule, and
is mutation-proven on both stylesheets. Lesson: when you widen a scan's scope,
re-run its mutation — a check that was accidentally correct for one input is
often structurally wrong for the next.
The five measured-clean results, with their methods, so nobody re-derives them:
(1) **Fort UI contrast: 0 WCAG AA failures across 10 surfaces.** Method is the
华丽 pass's (screenshot twice, once with all text ink transparent, decode both
PNGs, score each run's most fully-covered ink pixel against the background
revealed underneath). Its FIRST run reported 39 failures and every one was an
artifact — text sitting behind a modal scrim (deliberately dimmed) or clipped
below an overlay's scroll edge. So the method needs a third sampling rule
alongside "score the most-covered pixel, not the worst" and "an emoji-only run is
ART": **skip anything `elementFromPoint` says is occluded, and anything outside
its scrolling ancestor's box.** The instrument was then CALIBRATED by injecting a
known-bad run and confirming all 10 surfaces caught it — do that before believing
a clean sweep. Deliberately NOT added to CI: it costs 77s and currently finds
nothing, and this repo has already paid for a WebKit rasterization stall; the
method is recorded here so it can be re-run on demand. (2) **The roster is
colour-blind safe, and the reason is the silhouette law.** Under simulated
deuteranopia/protanopia/tritanopia the per-world hue floor collapses (60-81
colliding pairs, worst 2.2-3.7 against a shipped ≥20 floor) — but re-scoring the
near-twin SIGNATURE under the same simulation barely moves it (closest pair
rag/mole 2.16 normal → 2.03-2.23 simulated, against a 1.2 floor). Hue was never
doing the separating work, so the collisions are real and inconsequential. Do not
re-tint the roster for CVD. (3) **Tier art is readable at real play size** — every
tier step changes 98-536 pixels even at the smallest cell, so the tier-pip class
of defect has not returned. The two enemies flagged as "small" (pellet, ant) are
both skins of the swarm body, deliberately the tiniest sprite in the game; the
60px floor that flagged them was invented, not measured, which is the
fence-around-the-residual trap. (4) **Every fort control has a speakable
accessible name** — 48-192 controls across 9 fort screens, 0 nameless. Note the
probe's own scope bug first reported 1315 "controls" per screen: all screens share
one DOM, so an unscoped query sweeps Josh's 200 games. (5) **`td.css` is clean
against all four cross-cutting iOS laws** (no animated background, dvh paired
with vh, aspect-ratio with a height fallback, no `inset:` shorthand).
**And the playability half found no dead content: every targeting mode is the
best choice somewhere.** Measured over the 9 boss finales × 4 seeds on normal,
the best-mode tally is first 4 / strong 2 / close 2 / last 1, and the swings are
large — L4 reads first 10.0 vs last 1.0, L16 strong 16.3 vs close 7.8. Two
existing tests proved the MECHANISM (a mode is accepted; dart-on-strong
re-evaluates) but nothing drove a whole level under each mode, so the selector
could have been cosmetic and no test would have known; `AUDIT targeting is a LIVE
lever` now pins those two swings at a 4-life bar (6s, mutation-proven: neuter
`setTargeting` and both modes score an identical 5.3). The tier-4 BRANCH half of
that sweep was inconclusive and is recorded as such rather than dressed up — a
5-tower cap cannot clear L20/L28/L36 at all, so only L12 produced a signal
(branch "b" turned a loss into a 3.8-life win). A branch comparison needs a
board that can actually finish the level.
**The WITHIN-level shape was measured for the first time (every audit before it
compared levels to each other), and it confirms the designed shape holds where
a level bites at all.** Lives lost per wave, normal, best plan over 4 seeds:
**11 of 36 levels leak NOTHING** (L1/L2/L7/L19/L22/L23/L25/L26/L27/L31/L35) —
which puts a precise number on the flat-20 result this file already records, and
they are exactly the levels the step-function findings said could not be graded.
On every level that DOES hurt, the peak is the finale: L16 loses 26 of its 29 in
the last three waves, L20 29 of 48, L28 20 of 34, L32 13 of 26, L36 16 of 28.
Eight levels are front-loaded (≥50% of their damage in waves 1-3), worst L11 at
~5.0 lives per seed — right at, but not through, the shipped >5 gotcha bar, so
nothing is breached. No new defect; the value is the map.
**THE DECISION AXIS IS CLOSED: targeting priority is worth ZERO in this engine,
and that is threshold domination reproduced a SEVENTH time — now in the ORDERING
domain.** `PLAN_ENEMY_ESCORT.md` proposed 🌫️ Dust Bunny, an escort that makes
nearby bodies untargetable while it lives, on the "change a DECISION, not a
number" axis 🛢️ Oil Drum opened. Its whole value proposition is *kill this one
first*. Phase 1 built the instrument that could measure that — a decision-aware
oracle (`tools/td-sim.js --priority`) that spends 📌 Call the Shot on the body
that matters, using the shipped build loop otherwise — and the answer killed the
enemy before it was built: **focusing the 🔧 Junk Healer, the textbook focus
target in the whole roster, is worth +0.00 lives on normal AND heroic**, with
📌's price refunded and marks restricted to bodies a gun can actually reach.
🛢️ measures +0.00 / −0.08 the same way. The cause is not the one the plan
assumed (a solver with no positional agency) — a solver that CAN choose,
perfectly and for free, still gains nothing, because a board that holds a wave
holds it regardless of firing order and a board that collapses collapses
regardless. So the Bunny is CUT, and **a future "decision" enemy must change what
the board IS, not what it shoots first** — every lever measured to move this
engine is of that kind (a fork re-routes the lane, a gimmick changes the ground,
a threat shape changes what must be countered). Three method lessons, each of
which produced a WRONG answer first: (1) **a control arm that costs something is
not a control** — the first metric was `focus − spend` and read **+2.00 on
heroic**, which looked like the decision paying off; `focus − blind` was 0.00 and
the spend arm was simply harmful (56 marks × 70 gold diverted from building), so
the tool now prints both gaps and judges on `focus − blind`; (2) **calibrate on a
case that MUST succeed** — the null was only trustworthy once the Junk Healer arm
also returned 0.00, because without it "the mechanic is worthless" and "the
instrument measures nothing" are indistinguishable; (3) **verify the mechanism,
then the fixture** — a direct probe showed the mark "did not redirect fire" and
the instrument looked broken, but the body was out of every tower's range and
`markId` correctly only overrides among in-range candidates (re-run in range:
fire redirected, target 6 → 7). Also fixed while there: `tools/td-sim.js` parsed
`argv[2]` as a level list unconditionally, so `--priority` with no level argument
became `[NaN]` and silently selected nothing.
**THE ART PASS (T1-T3): the fort had shading but no LIGHT, and the three defects
it surfaced were all in the SEAM, not the sprites.** Diagnosed by screenshotting
all nine worlds mid-combat at 390x844 rather than reading the renderer: every
shadow was a centred grey blob so nothing agreed where the light came from, the
floor (~75% of the screen) was a two-stop gradient with imperceptible speckle,
and the lane was a decal printed on the room. Fixed with ONE global `LIGHT`
vector driving three things, each through a seam that already existed — the
baked `bakeBg()` (zero per-frame cost), the ONE `shadow()` helper all 50 unit
call sites use, and `withInk()`'s existing fill interception. A 52nd enemy and a
5th tower line inherit the model for free.
Four things worth keeping, every one of which cost a wrong answer first.
(1) **The baked plate is NOT in screen space.** It is world-oriented and drawn
through a 90° rotation in portrait, so a shadow baked "down-right" comes out
down-LEFT on a phone; the bake must use the inverse of `w2s`'s rotation. The
same +0.5/rotation class this renderer has been bitten by repeatedly — and it is
invisible in a screenshot, because the bedroom's `stain` props look exactly like
cast shadows. I nearly "corrected" a correct rotation because of one. The
guardrail (`ART: the field is lit from ONE direction, in BOTH orientations`)
samples a ring around every prop and compares lit-side against shadow-side luma
(portrait +6.90, landscape +28.57), and its OWN first version used a fixed 16px
ring — about one cell in landscape but well past the prop in portrait, where the
cell is less than half the size — and reported a meaningless −0.19. **A sampling
radius that does not scale with the thing sampled is not a measurement.**
(2) **A lit edge must be CLIPPED to the body.** Translating the stroke toward
LIGHT made it poke past the ink on the lit side and BRIGHTEN the contour: the
silhouette guardrail went red naming nine enemies. Clipping to the current path
confines the highlight inside the shape — which is what a rim light is — and
leaves the contour the ink line's. 9 failures → 1, and **the last one was not
the highlight at all**: isolating the halves showed the Grease Racer failed with
the lit edge OFF, because its contour had been passing on darkness BORROWED from
its own drop shadow. Two consequences: occlusion under a body covers the WHOLE
body (a shrunken core is neither physical nor safe), and a cast that is too wide
inflates the sprite's measured ink mask so the guardrail samples the SHADOW's
edge instead of the body's.
(3) **The highlight is OFF by default, and that is a measurement.** A/B at L24's
162-enemy peak: 2.22 ms baseline → 2.67 with the directional shadow → 4.49 with
the lit edge on everything. The extra 1.82 ms is almost all the per-sprite
`clip()`, the worst thing to spend on a software rasteriser — and Josh's iPad and
CI's real WebKit both rasterize in software, so a Chromium number here
UNDER-estimates. A rim light on a body a few pixels across is invisible anyway:
the swarm was paying most and showing least. Towers and bosses opt in; final cost
3.18 ms against a 16.7 ms budget.
(4) **A muzzle flash drawn in the FLOOR pass is painted and then covered
completely by the tower.** Firing had a sound and no picture — the engine has
always emitted `shoot` and td-main has always played a tick for it, but nothing
was ever drawn, so a projectile appeared out of the air on a 14-gun board. The
first fix measured **zero changed pixels across the whole canvas**, which reads
exactly like "the effect does not work"; it was drawing correctly, one pass too
early. A muzzle flash belongs in front of the gun that made it. Its guardrail
asserts the INK (same state drawn twice, once with the flash queued) rather than
the event, because a feature whose test only calls the API is untested as a
feature.
**Also hardened: `(s.rangeMin || 0) * mods.mortarMinMul`.** 🎯 Close Quarters
multiplies a tower's minimum range, and a stat block lacking the field makes
`undefined * 0.6` NaN — `d2 >= NaN` is false for every enemy, so the mortar would
silently never fire again. Both shipped tier-4 branches declare one by luck, not
design. The coercion makes it degrade, and a derived guardrail asserts that a line
with a dead zone declares it at EVERY tier and EVERY branch (with a
not-vacuously-true check, since some lines correctly have none). Third instance of
the class after the `mult`-less zone and the `delay`-less wave group: **a data
field one short must degrade, not disable.**

**Josh's SVG art shipped entirely FLAT — 371 lines of `art.js`, zero gradients,
zero filters — and the fix had to route around a defect this repo had already
hit and reverted.** A head, a cube and a balloon were all the same solid disc of
colour, in the library that draws the home companion, every win pop and all 200
Sticker Book slots. The naive fix is refuted in the code: `stickers.js` carries
a comment recording a first cut where every badge emitted its own
`<defs><radialGradient id="bg">`, and because **SVG fragment ids resolve
DOCUMENT-WIDE** while the Sticker Book paints 200 pictures into one page, every
`url(#bg)` collapsed onto the FIRST sticker's gradient — invisible to any string
test, since the strings all differ and only the RENDERING collapses. The escape
is not "no gradients": it is **ONE shared definition in `index.html`**, and it is
only correct because the three gradients are **ALPHA-ONLY** (white → transparent
→ black), so they carry no colour of their own and sharing them across 240
differently-coloured pictures is right by construction. The whole document pays
for **3 gradient objects instead of 200**. Four things worth keeping. (1) **A
`<filter>` is still banned** — a filter on art rendered by the hundred is the
documented WebKit rasterization cliff that once stalled CI for over an hour;
gradients composite in the same pass, filters force their own. Measured cost of
the whole change: the Sticker Book went **2860 → 3340 svg nodes (+16.8%) with no
change in build time** (Chromium; CI's real WebKit walks that page in
`mobile.test.js`, which is the honest proof). (2) **The flat fill and its
highlight come from ONE template** (`lit(shape, fill, grad, strokeAttrs)`, with
`{F}`/`{S}` placeholders) — a hand-copied second path is exactly how a highlight
drifts off its body, and the e2e guardrail measures that directly: it renders
the art with the surface passes neutralized and fails if the light changes any
pixel the flat drawing left as background. (3) **Every reference carries a
` none` fallback** (`fill="url(#jart-lit) none"`) so an absent block degrades to
the flat drawing rather than an engine-dependent black blob — **but the pixel
assertion for that was deliberately NOT kept**: the mutation that removes the
fallback renders identically in Chromium, which already treats an unresolved
paint server as `none`, so the claim could not fail on the engine that runs it.
It is pinned by the string guardrail (which the mutation DOES fail) and the
fallback stays as defence-in-depth. A test that cannot fail is worse than no
test. (4) **A scan matched its own documentation, for the third time this
session** — the "art.js must not emit `<defs>`" check fired on the comment
explaining that very rule, so both the HTML and the JS are comment-stripped
before scanning; same family as the `bg` id "declared in index.html" that was
only ever prose. Sampling lesson, the same one as the fort's baked-light probe:
the first direction test sampled "the upper-left of the head" and landed inside
the dark HAIR, reporting a confident −63 on art that was correct — so the claim
is split into three unconfounded ones (the gradient is measured on a neutral
grey swatch; a string test proves every kind uses it; a pixel test proves it
stays inside the body).
**Three shipped tests went red, and all three were RIGHT to** — recorded because
the resolution is the interesting part. Two counted cubes with `match(/<rect /g)`
and now saw 2n, so they count the FLAT cubes and additionally assert exactly one
lit twin each: the property is restored at full strength AND the `lit()` pairing
invariant is now pinned at the unit level, which is strictly more than before.
The third is the real one: `the Sticker Book gives every game its OWN sticker`
banned `url(#` outright, and it was written for exactly this defect. It was
narrowed rather than dropped, because the collapse is caused by **200 competing
DECLARATIONS, not by the reference** — a sticker still may not declare an id, and
it may now reference only ids `index.html` actually declares (derived from the
file, not listed in the test). Both halves mutation-proven. And the reason those
three escaped the per-suite sweep is its own lesson: **`tests/art.test.js` was
not in this file's repo-structure listing**, so enumerating suites from the doc
instead of the directory missed a whole file — the "a scan's own list is part of
the scan" class, this time with the list being CLAUDE.md. It is listed now.

**The fort's BODIES did not react — and the two cues that fix it cost four
false-passing tests to prove, every one of them a confound this file already
warns about.** A shot landed as a poof in the AIR (the `hit` event said WHERE,
never WHAT) and a killed enemy simply blinked out mid-stride while its stars and
gold played over bare floor. Both turned out cheap: an enemy is only ever
FLAGGED dead — never spliced — and the `die` event has always carried the enemy
TYPE and its position, so **the corpse is a pure render concern**, and the flash
needed exactly one new field (`id: target.id`, the shape `dmg`/`tower` already
took; events are not part of `state`, so the determinism hash cannot move). Both
ride seams that already exist: the flash re-fills the path the `ctx.fill`
interception has just filled (no clip, no filter, so all 51 bodies and a 52nd
inherit it), and the corpse is the real sprite drawn squashed and fading in the
CHARACTER pass. Five things worth keeping. (1) **A white hit-flash does not work
on this roster, and that is a measurement.** The bodies are deliberately PALE —
the whole reason the ink line exists — so a FULL white overlay moved only ~119
device pixels of a sock at cell 27, most of them by under 24/765 of RGB. The
flash is two cues now: a warm tint, which carries the dark bodies and is the
entire cue under `prefers-reduced-motion`, plus a brief SCALE pop, which reads on
any colour because it moves the silhouette itself (103 → 304 changed pixels). The
pop is motion, so it is gated exactly as the screen-shake is. (2) **A `hit` also
pushes a poof AT the hit point**, so a test that fires both events on the body is
measuring the poof — the first cut survived deleting the whitening AND deleting
the engine's id. The flash is keyed on the ID, not the position, so firing the
hits six cells away puts the poof outside the sample box and leaves the flash on
the sprite. (3) **`draw()` ages every fx by one**, so pushing a second `die` to
get a control ADDS a second set of stars on top of the first; the fix ages the
board empty between frames and asserts a `residue` of ~0, which makes the
isolation self-verifying rather than assumed. (4) **The +0.5 trap, for the fifth
time, and this time inside a test** — `posOn()` is corner-based and the enemy
pass draws at `worldToScreen(pos + 0.5)`, so sampling the corner read 22 changed
pixels on a flash that works; worse, in the corpse test TWO such errors cancelled
(the event pushed half a cell off, sampled half a cell off), which is exactly how
a wrong convention hides. The shipped muzzle guardrail already had the right
convention and was the tiebreaker. (5) **A browser test that drives `pushFx`
directly proves the RENDERER reacts to an id — it cannot notice the ENGINE no
longer sending one** (verified: deleting `id: target.id` left it green), so that
claim lives in the engine suite instead. Same family as "a feature whose tests
all call the API is untested as a feature", one level down.

**A VISUAL vet of all 36 levels — screenshot every board, then magnify — found
four defects that every numeric guardrail had passed, and the headline is that
three of them came from the same place: something drawn into the BAKED,
world-oriented floor plate that should not have been.** Reported as "the
entrance bed isn't on the path" and "some of the shadows are just circles after
circles". (1) **Every prop carried THREE shadows from TWO owners.** The prop
placement loop drew a flat-alpha, hard-edged ellipse, and when the lighting pass
later gave `drawProp` its own cast and contact, that one was never removed —
and because it was drawn in bake space with no counter-rotation, the 90°
portrait rotation stood it on end, so on a phone it was a TALL oval sitting
BESIDE the prop. Measured per prop: 44×45px at aspect **0.98** — a disc — centred
on the object; after removing the duplicate, 20×11px at aspect **1.82**, offset
down-right from the light. `drawProp` is the one owner now. (2) **Prop BODIES
were rotated too** — a stack of bricks rendered as three vertical bars standing
side by side, a suitcase stood on its end. A prop is an OBJECT, not floor
texture, so the blit is counter-rotated by the same angle the shadow ellipse
uses; the bake stays free and props are upright in both orientations. (3) **The
shadow gradient was CIRCULAR under an ELLIPTICAL fill**, so on the short axis the
ellipse cut the ramp off at ~25% alpha and left a hard rim; `softEllipse()` draws
a unit circle under a translate+scale, so the falloff is elliptical by
construction and reaches exactly zero at the boundary. (4) **World 1's floor
never had a texture at all**: the bedroom declares `carpet` and no such branch
existed, so the first floor anybody sees painted as a bare gradient — the
documented "a data field with no implementation fails silently" class, invisible
to the floor guardrail because that hashes the canvas and the palette alone
still differed. A derived check now fails if any world's declared pattern has no
branch. And the bed: a lane's first and last waypoints sit at the board EDGE, so
both markers were centred half a cell in, straddling the lane's rounded end cap
with the cap poking out past them; they are stepped 0.85 cells ALONG the lane
now.
Four method lessons, each of which produced a wrong answer first. **A
measurement derived from the same data it is checking cannot fail** — the first
"is the spawn on the lane?" probe computed the glyph position from `lane[0]` and
then measured its distance to the lane: 0.00 on all 36 levels, by construction.
**The fix for that metric was wrong too**: "distance from the board edge" reads
0.00 forever on L21, whose lane runs out along the bottom row, so the honest
quantity is how far the marker is inset ALONG the path. **A screenshot is not a
diagnosis** — I read the ovals as being on the lit side and nearly "fixed" a
correct shadow direction (the centroid measured −0.90, correctly opposite the
light), then read them as baked floor, then as prop bodies; only suppressing
`propCells` and diffing the canvas identified them, and only classifying the
differing pixels as *darker* vs *more colourful* separated shading from ink.
**And a clamp that never fires is not a fix**: the first cut for the bed clamped
the glyph inside the canvas, and the outermost canvas rows measured byte-identical
with and without it — the bed was never actually clipped, so the clamp and its
guardrail were both deleted rather than shipped as unfalsifiable code. One
finding is recorded WITHOUT a change: World 9's `mould` floor is a tiled field of
dark cavities, which reads much like the defect just fixed, but it is the
declared, world-appropriate texture for a moulding room and changing it is a
design call, not a bug fix.
**Three photos of the real iPad closed that item, and each one caught the
NEIGHBOURING property to the one I had just confirmed — which is the failure mode
worth writing down, not any of the three bugs.** Round one moved the spawn/exit
markers along the lane so they stopped straddling its rounded end cap; I verified
the POSITION and stopped, and the reply was "I still see bed not in lane". It was
right: the painted road is exactly 1.00 cells wide and the bed emoji drew at
**1.11**, so it hung over both kerbs. Round two capped the marker to the road —
and the reply was "still not centered". Also right: the glyph was now the correct
SIZE at the correct ANCHOR, and its INK still sat off-centre inside its own box.
Position, size, placement-within-the-box are three independent properties of one
picture, and confirming any one of them says nothing about the other two.
Four things generalise. (1) **`measureText`'s `actualBoundingBox*` fields are not
a cross-engine truth.** The first ink correction used them, measured right in
headless Chromium, and a photo of the real device still showed the bed over the
kerb — WebKit has reported those relative to the text ORIGIN rather than the
alignment point, which pushes the glyph the wrong way. It is now an `inkBox()`
that renders the glyph once to a scratch canvas and scans alpha for the real
bbox: a rasterised picture cannot be engine-dependent the way a metric is. Cached
per glyph+size, so it is a handful of tiny draws for a whole run. (2) **Fit by
the INK width, not the advance** — the advance carries side bearing, so fitting
by it leaves the picture narrower than asked on one engine and wider on another,
and "does it fit the road" is a question about the picture. (3) **A mutation that
PASSES is telling you the test measures a no-op in this environment.** Deleting
the ink centring moves Chromium's bed ~0.04 cells and the assertion still passed
— which is precisely why the metric-based fix looked correct here and failed on
Josh's iPad. So the centring is proven by MECHANISM instead, with a glyph whose
ink is off-centre in every font (a descender `g`, which sits low in its box); it
fails at 0.07 cells against a 0.05 tolerance. When the sandbox cannot exhibit the
defect, find an input that makes the mechanism observable rather than widening
the tolerance until the real glyph passes. (4) **A per-level visual vet must walk
the FEATURE space, not the level list.** The same photo showed a column of dark
ovals down L2's lane which I had been reading as shadows for two rounds; they are
the ⛱️ Blanket Cover zone, which stamped a full-cell ellipse every 0.6 cells and
so painted ~26 overlapping discs plus ~40 hem circles — the literal
circles-after-circles the prop fix had just removed elsewhere, surviving in the
one place my vet could not see it, because **L1 has no zones**. It is one
continuous stroked sheet now (3 canvas ops, not ~66). Its guardrail was itself
confounded twice before it could fail honestly — first by the road ties under the
band, then because alpha compositing removes luma in proportion to the base, so a
uniform overlay over a textured floor yields a VARYING absolute difference; the
invariant is `diff/base`, and the thinnest point must be ≥60% of the thickest.
**And fixing the cover band did NOT fix the mud patch, because they are the same
law in two different drawers — which is the whole reason RULE 7 says centralize
the correct way rather than patch the case in front of you.** The mud kept
stamping an ellipse every 0.6 cells, so 🕳️ mud shipped as a row of discs on
**L1, the first level anybody plays**: the original "some of the shadows are just
circles after circles" was still literally true there after two rounds of fixing
it elsewhere, and the vet that would have caught it looked at levels rather than
at MECHANICS. A per-level visual pass must walk the feature space — every gimmick,
every band kind — not the level list. Both ground bands are now one filled body
between two wobbling rims (the rim keeps it organic, which is what the stamps were
for; the body between them is unbroken, which stamps never are), and the bubbles
scatter across the puddle instead of filing down its centre-line and rise toward
SCREEN-up via `bakeVec` — the zone pass runs inside the rotated floor transform,
so a bare `-y` drifted them sideways in portrait.
Four measurement lessons, and they matter more than the fix. (1) **The defect was
not what it looked like.** The stamps were 0.84 cells long at 0.6 spacing, so they
never actually GAPPED on the centre-line — they double-covered, and
`1-(1-0.55)² = 0.80` against a declared 0.55. "Circles after circles" here is
periodic OVER-darkening, not holes. Diagnose before you threshold. (2) **A metric
can be wrong three times running, each time looking exactly like a defect in the
drawing** — raw luma along the lane varies from the road's own rungs; the
DIFFERENCE against a zone-less render varies because alpha compositing removes
luma in proportion to the base; and that difference as a RATIO goes NEGATIVE on
the sort line, whose belt is darker than the mud so the mud LIGHTENS it — it
reported −1.28 on a band that is perfect. The invariant is the overlay's own
ALPHA, recoverable because the colour is known: `a = (base−got)/(base−C)`. It is
sign-safe and comes back as the literal 0.55/0.40 the renderer declares, which is
what makes it a measurement rather than a number tuned until it passed. (3)
**Smoothing added to defeat a confound destroyed the test's ability to fail.**
Taking the median of five samples ACROSS the band (to see past a lever level's
centre dashes) left the stamped code GREEN, because averaging across the width
hides a seam that runs along it; and the spread-based threshold scored the stamped
version at **0.602 against a 0.6 floor** — passing by 0.002, which is luck, not a
guardrail. The fix is to assert against the DECLARED alpha: a single fill cannot
exceed its own alpha, so overlap is the one signature of stamping that cannot be
faked, and both bounds are mutation-proven (restore the stamps → peaks at 0.796;
draw the band at the wrong shade → drops to 0.304). (4) **When a designed overlay
makes a surface unmeasurable, exclude by what the level IS and cover it another
way.** A lever level paints a route indicator along the lane — a continuous glow
plus 90%-opaque running dashes at an 0.85-cell period — so no offset clears both,
and the L7 numbers that looked like a beaded band were the indicator. It is
excluded by `paths.length > 1` (derived, not an id list) and covered instead by a
structural guardrail that counts `ctx.ellipse` calls by DIFFERENCE against the
same level with its zones removed: shadows and props cancel, the zone pass is
what remains, and it is immune to anything painted on top. Pixels where they can
be trusted, structure everywhere.
**A LIFETIME DECREMENTED AT THE BOTTOM OF A BRANCHY LOOP IS ONLY CORRECT FOR THE
BRANCHES THAT DO NOT EXIT — reported from real play as "some of the bad guys
after being killed are stuck on the map, 0 health sprites just persisting there
wave after wave", and it was a one-word regression in the death-corpse feature
shipped two commits earlier.** `f.ttl -= 1` sat as the last statement of
`drawScreenFx`'s draw loop, and the corpse branch draws in the character pass and
then `continue`s — so a `pop` fx was never aged, never faded, and was never
spliced. It renders from a synthetic carrying `hp: 0`, which is *literally* the
0-health sprite in the report, and `MAX_POPS` (20) of them accumulated on the
field permanently; worse, once that cap filled the corpse cue silently stopped
working at all, so the feature both broke the board AND stopped doing its job.
Ageing is now its own branch-free pass after the loop, so a future fx kind that
needs a `continue` inherits a correct lifetime for free. **The reason the shipped
test could not catch it is the sharpest part:** the corpse test's FIRST
`pushFx({type:"die"})` deliberately omits `enemy` (stars + gold only, no pop) so
its 40-frame ageing window is clean, and it reads the corpse on the very next
frame — so no `pop` ever existed while anything was being aged. It proved a
corpse is DRAWN; nothing proved it goes AWAY. When you add an effect with a
lifetime, the test that it APPEARS and the test that it EXPIRES are two different
tests, and only the second one would have caught this. Guardrails: a browser test
that pushes a real corpse and asserts the field returns to baseline 60 frames
later (mutation-proven — 321 stray pixels remain on the pre-fix code), plus a
structural `site.test.js` check that the decrement has exactly ONE owner and that
it sits outside the draw loop (the `keepAwake`/`hurriedMult` one-owner shape). And
the diagnostic lesson: the user read them as corpses, my first four hypotheses
were all ENGINE-side (a retained-dead filter, a zeroed `effSpeed`, a `blockedBy`
stalemate, an hp≤0-but-alive body) and every one was refuted by measurement —
`finishIfWaveDone` requires every enemy dead, `slowCap` is 0.6 so a slow can never
freeze anything, and `dealDamage` is the only hp write and always calls
`killEnemy`. The renderer skipping `!e.alive` was the clue that mattered: if the
engine cannot draw a dead body, a body on screen that will not move is not the
engine's.
**Closing that hunt's own two loose ends produced one real coverage finding and
one refuted worry — and the coverage one is the sharper.** (1) **The camp BLOCK
path measures CLEAN, but `blocks: 2` was dead code.** Neither winnability oracle
buys a camp, so `blockedBy` — the only code in the engine that can stop a live
enemy indefinitely — was exercised by a handful of bespoke tests and nothing
else. Driven properly (one level per world, camps on every pad, 6 waves) it holds
every invariant: 0 violations, **2172 enemies actually blocked**, 10.3s. The
finding is underneath: **`blocks: 2` (hold TWO at once) exists on exactly ONE
stat block in the whole game — the Dino Squad tier-4 branch — so
`countBlocked`/`maxBlocks` never executed at any tier anything in the suite ever
built. And the enemy loop's dead-blocker rescue is load-bearing ONLY for
`blocks > 1`**: deleting it leaves the plain-camp sweep green AND both sell tests
green, and only a Dino board goes red (240 ticks held by a fallen soldier),
because with `blocks: 1` the soldier engages the one enemy it holds and the
melee-death path clears that foe as it falls. That line could have been deleted
and the whole suite would have stayed green. Two lessons on stating the
invariant: it must be "**freed within ONE tick**", not "never held by a dead
soldier", because soldiers die in `soldierTick()` which runs AFTER the enemy
loop, so a second held enemy legitimately points at a just-fallen blocker for
exactly one tick (measured — the same "check the DURATION before calling it a
freeze" trap that made a moving pinata look stalled); and `<= 1` is VACUOUS in
the plain case, where the state never arises at all, so that test asserts
**exactly 0** (pinning the melee release, mutation-proven separately) while the
Dino test asserts `<= 1` (pinning the rescue). A third test — "selling a camp
releases what it held" — was written and then REMOVED: a shipped test already
drives that exact path, and measurement showed `sell()` clears `blockedBy` itself
so it cannot pin the rescue either. A near-duplicate is noise, not coverage.
(2) **World 9's `mould` floor was flagged as maybe reading like the disc defect,
and the worry is REFUTED by measurement, so nothing changed.** Densely sampling
every floor pixel ≥3 cells from every lane and ≥2.5 from every pad (~40k px per
world) puts mould at **sd 27.5, sixth of nine** — calmer than concrete 52.3, tile
51.1, dropcloth 50.4, cardboard 40.9 and boards 38.4. It is also structurally the
opposite of the defect: its wells are 0.84 cells wide at **3.2-cell spacing**
(separated, ~26% coverage) where the stamps were 0.84 long at 0.6 spacing
(overlapping), and a screenshot shows a regular grid with the lane completely
clear. A "floor busyness" guardrail was considered and deliberately NOT added —
the shipped range is 16.7-52.3, a 3× spread, so any cap would be an invented
threshold, i.e. the fence-around-the-residual this file warns against. Sampling
note worth keeping: the first pass scored only cell CENTRES and can
systematically miss or hit a texture whose period (3.2 cells) is unrelated to the
sampling grid — the phase-alignment cousin of "a sampling radius that does not
scale with the thing sampled". Dense per-pixel sampling is what makes the number
mean anything.
**🧸 KID FORT IS RETIRED (owner, 2026-08: "we don't use it") — removed WHOLE, and
that is the decision worth recording.** Deleting only the button would have left
the `kid` difficulty, its `noLose` branch and the `body.td-kid` skin in the tree
with nothing able to select them — precisely the dead-feature class this project
has already paid for twice (heroic shipped working but unreachable; World 4's
levels shipped with no card on the grid). So the button, the difficulty entry,
the engine's `noLose` read and the whole kid skin went together, and the
guardrail is a LAYER SCAN that fails if either half creeps back: a button with no
mode, or a mode with no button. Two consequences. The engine's losing site is now
UNCONDITIONAL, so the tests that used to prove "the kid gate does not leak into
the adult ladders" became the simpler, stronger claim that **no difficulty is
exempt**, with the list DERIVED so a future tier cannot ship unlosable by
omission. And a REMOVAL is the one time this project's "additions-only, never a
regression" rule is deliberately overridden, so it is stated rather than implied:
coverage of a retired feature was dropped on purpose, and coverage of everything
that remains got broader.
**Two UX reports from the same session, both about things not fitting.** (1) **A
dialog that scrolls must be closable from the TOP.** The star tree is 30 nodes
against an 86dvh box and its only exit was a "Done" at the very end, so shutting
it meant scrolling the whole tree. Every meta dialog now gets a sticky ✕ injected
by `metaOverlay` — ONE owner, so a new dialog inherits it — while the bottom Done
stays as the natural end of a read-through. The guardrail DERIVES the opener list
from the fort home's own buttons (the "a scan's own list is part of the scan"
lesson that had already left the 🎒 Powers picker invisible to the overlay audit),
and it first proves the tree genuinely overflows its box — otherwise it would be
asserting a scroll-free close on a dialog that never needed one. (2) **A cost
line carrying two emoji could not fit a 40px tile.** The ability strip shipped
its price as ONE string, `130🪙 ·1⚙️`, measured at **46.9px inside a 40px content
box** — so it wrapped mid-string and the second line spilled over the rounded
border, exactly as the owner's photo showed. Gold stays on the line and the ⚙️
charge moved to a corner badge, taking the widest tile to ~29px with 11-17px of
headroom — real margin, which matters because **iOS renders emoji WIDER than
headless Chromium** (the trap that has now bitten the tower panel, the next-wave
line and this). Three smaller lessons: a `display: block` span is as wide as its
parent whatever it contains, so the test measures the TEXT's ink via a Range, not
the span; the badge's inset is a MEASURED constant, because 2px below the top
edge a 14px corner radius is still ~7px inboard and a bounding-box assertion
cannot see a corner being shaved by `overflow: hidden`; and the self-verifying
clause ("the split must still be load-bearing") immediately caught itself
over-claiming — a two-digit cost really would still fit combined at 320px, so it
asserts the WIDEST tile rather than every tile. The same pass found the tile's
icon/name/cost typography **declared twice** — unscoped, ~320 lines below the
base rule — so the ≤359px media block asking for a 1rem icon and a 0.55rem cost
was a dead letter and a 320px phone rendered identical type to a 414px one. That
is the documented "a size declared twice has no owner" bug, second instance, same
element.
**And the container silently re-cloned to a stale commit for the THIRD time in
one session**, mid-task: `HEAD` went back to a commit from before nine pushed
commits, `git status` reported CLEAN, and the edits in progress were sitting on
that old base — so the working tree looked healthy while CLAUDE.md had quietly
lost ~800 lines. It was caught only because a `grep` for a learning written
minutes earlier returned nothing. The recovery that works: snapshot the working
diff and the whole tree FIRST (`git diff > patch`, `tar` the worktree), then
`git fetch origin main` (the remote is intact — it is only the local clone that
rolls back), `git reset --hard origin/main`, and re-apply with `git apply -3` so
overlapping files 3-way merge instead of clobbering. Lesson: **on a remote
runner, "git says clean" is not evidence your work is present** — verify against
a fact you know should be there (a line count, a string you just wrote), and
never trust a clean status alone after a container restart.
**The mechanism was then diagnosed, and it is not a rollback or a re-clone: the
runner's writable disk is RESTORED FROM A SNAPSHOT.** The evidence is the reflog
— it jumps from a commit made on 31 July straight to the manual `reset` days
later, with **none** of the session's pushed commits in it, because they were
made in a different (discarded) container's filesystem. `package.json` and
`.git/HEAD` still carry the original clone's mtimes, while `/root/.claude/*` are
all stamped at boot: the platform reprovisions ITS files every restart and the
repo comes back from a fixed image. A fresh `git clone` would leave
`clone: from …` in the reflog and today's timestamps; neither is there.
`.claude/resync-main.sh` + `.claude/settings.json` now run on SessionStart and
fast-forward the clone when — and only when — it is strictly BEHIND origin/main
with a clean tree, which is the rollback signature and the one case with nothing
local to lose. A dirty tree is never touched (uncommitted work is the only thing
the remote cannot restore); an AHEAD head is left alone (that is unpushed work);
anything off `main`, in sync, or unreachable is a silent no-op; and it always
exits 0 so a network blip cannot wedge startup. All five branches were driven in
a throwaway clone rather than the live one.
**Its honest limit, stated because a half-fix that reads as a fix is worse than
none: the hook lives IN the repo, and the repo is what rolls back.** Restoring an
image that predates the hook restores a tree without it, so it cannot fire on the
very image this container is pinned to. It closes the problem for every clone
that contains it — any new session or environment created from current `main` —
and until then the manual check stands: compare `git rev-parse origin/main`
against a known SHA, never a clean `git status`.
**"The upgrade colour flashes purple even if I cannot afford it" turned out to be
TWO defects, and the second one was arithmetic, not timing.** (1) The affordance
was painted a frame LATE: `UI.prices()` ran only from `UI.hud()`, so the tower
panel was revealed in its BASE colour (the branch cards are purple, the upgrade
yellow) and only went red on the next frame. The build menu never showed it
because that path happened to call `UI.prices()` synchronously right after
`showBubble` — so the same bug had a workaround on one path and nothing on the
other, which is why it read as intermittent. `showBubble` now paints every price
BEFORE `hidden = false`, as the ONE owner. (2) **The panel re-derived prices from
`DATA` while the engine charged a discounted number.** `upgrade()` applies
`mods.upgradeCost` (🔧 Handyman, ×0.9) and `branch()` applies `mods.branchCost`
(💰 Bulk Deal), so an owning run was SHOWN 110 and CHARGED 99 — and the button
sat red **and `disabled`** across the whole 100-109 band it could actually
afford. Branches had a 26-gold dead band. Fixed by making the engine the single
source of price: `priceOf(kind, arg)` is the one computation, `place`/`upgrade`/
`branch` all read it, and the UI asks the engine instead of doing its own maths —
the "ASK THE ENGINE which modes this run allows" lesson already recorded for
targeting, applied to money. Building is undiscounted today and routes through it
anyway, so the next economy node cannot reintroduce the bug on a third path.
Three method notes. **A redundant fix makes its own guardrail unfalsifiable**: I
first kept BOTH the pre-reveal paint and a synchronous repaint after it, and the
no-flash mutation stayed GREEN because either mechanism alone was sufficient —
the test only went red once the repaint was deleted and `showBubble` genuinely
owned it. **And the cache I reached for first was wrong in a way that looked
equivalent**: painting from a gold value cached by `UI.hud()` fails whenever gold
moves without a HUD tick, which the shipped RED→GREEN test does deliberately —
so prices read the LIVE gold through a source function instead. That test failing
is what caught it, which is the argument for running the whole suite rather than
just the new cases. Finally, the panel now **stays open and re-renders** after a
purchase (a tower can go 1→2→3 in one opening) — the honest way to keep a dialog
up is to rebuild it from the subject's CURRENT state, since tier, price, stat
line and sell refund all move; only SELLING closes it, because then the subject
is gone.
**华丽's first BEHAVIOURAL pass — driving all 40 of her games and READING every
spoken line — found the one quiz that never said its own answer, and then a
much bigger app-wide defect one file over.** (1) **月亮圆缺 never named a
phase.** Every sibling restates the truth on a correct tap ("对！是兔！",
"找到了！是四筒！", "西瓜是夏天的，答对了！"); the moon game said only "月亮就
是这样慢慢变圆的" — so the game *about* phases named none of them, on the
channel a 70-year-old actually uses, and all three chips carried the same
`aria-label` "月相". `MOON_NAMES` is the single owner (spoken line + label), the
SPOT_NAMES pattern extended, and 描福字 stopped speaking the bare numeral it
prints (`"1"` → `"第一笔"`, via `CN_NUM`) — the digit-shaped cousin of speaking a
picture. (2) **The DISTRACTOR audit came back CLEAN, and that is the deliverable
too**: ~500 distinct rounds captured across her 23 pick-the-answer games (量词,
反义词, 节日, 名菜, 四季, 灯谜, 唐诗, 成语, 生肖, 月相, 顺子, 记菜单, the
arithmetic set) and no distractor is also-defensible, no analogy inverted, no
emoji spoken. The one marginal call is recorded rather than "fixed": 大雁 is
keyed to 秋 and 春 is always on offer, but 秋高气爽、大雁南飞 is the canonical
Chinese association and inventing a defect to look thorough is worse than
leaving it. (3) **The real find: a celebration can fire on a screen the player
has already left.** `framework.js` gated winCue/goodCue/bumpCue and every spoken
line on `!screen.hidden` — and left the two lines *between* them, `FX.confetti()`
and `FX.stars()`, ungated. Four games defer their win behind a raw `setTimeout`
(300-650ms) whose `isConnected` guard can never be false, because `route()` only
HIDES a screen. Measured: tap the last answer of **color-number / drive-home /
how-tall / sink-float** and press 🏠 inside the delay, and full-screen confetti
+ stars rain over the launcher — 4 of 4. Fixed the RULE-7 way: ONE `live()`
predicate and ONE `cue()` owner that every celebration goes through, so all 240
games inherit it, with a `site.test.js` line scan (any `FX.confetti`/`FX.stars`
not inside `cue(` fails) and a browser test, both mutation-proven. The *win
itself* still records — it was earned; only the party is withheld. Note the
tell, which is the wake-lock lesson exactly: **two adjacent lines disagreeing
about whether `hidden` matters means one of them is wrong.** (4) **Three
fixtures in a row measured nothing, each for a different reason, and that is the
lesson worth more than the fix.** The registry probe read `Object.keys(window
.JoshGames)` — it is an ARRAY of defs, so the `"hl-"` filter matched nothing and
a 40-game world reported **0**. The round sampler re-navigated to a WON game to
restart it, but the framework does not re-run `start()` on a re-show, so every
attempt after the first exited instantly on `dataset.won` and it looked like the
games repeat one fixed sequence forever (press the real Again button). And the
first two confetti probes navigated home *after* `dataset.won` had flipped (i.e.
after the deferred win had already fired) and then guessed at "the last tap"
with a heuristic that fires in round 1 of a 4-round game — both reported a clean
**0/240** on code that was provably broken. **A negative result from a fixture
you have not falsified is not a negative result.** The way out was to stop
guessing the moment: leave after EVERY tap, wait out the longest deferral, come
back. (5) **A measured non-defect, recorded so nobody re-opens it:** a scan for
tappables sharing an accessible name found 5 pure-art cases and 44 label-over-
content cases — and the 44 are mostly CORRECT (a memory tile must hide its face;
a find-the-odd-one hunt should not hand the answer to assistive tech), so it is
a false-positive machine, not a defect list. 脸谱找对 keeps its six identical
"脸谱" labels for the same reason naming them would solve the game. 月亮圆缺 was
the exception only because its row is `aria-hidden`, so naming the chips spoils
nothing and the spoken answer is pure instruction.

**Going after the flat levels found a TRAP instead — the fourth lying stat line,
and this one actively loses you the game.** The starting point was a measurement:
across 8 seeds on normal, **12 of 36 levels finish 20/20 on every seed** (L1, L2,
L7, L19, L22, L23, L25, L26, L27, L30, L31, L35), and every level that costs real
lives has a boss. (1) **The additive, budget-exempt mini-boss is a NEGATIVE
result — it is a disguised constant.** Keeping the wave and ADDING one fat body
with a multi-life toll avoids the concentration trap that killed the swap
version, and it does move the number: on L26 it goes 20 → 17 between 2400 and
3000 hp. But the **spread across 8 seeds is 0 at every hp** — all seeds agree
exactly — and it stays 0 when the body is given the Static's random-gun `disable`
kit, a backbone `spawn` kit, both, or is split into three bodies at toll 1. A
threat with no seed coupling sets a price, it does not create tension, so the
level would be identical with three fewer starting lives. The shipped bosses that
DO grade (L8 `11,10,11,11,18,11,18,10`, L16, L36) get their variance from kits
big enough to change the board, not from being fat. Do not rebuild this.
(2) **What the experiment found instead: converting every Dart to Sniper Scope
LOSES the level.** L22, L26 and L31 all go from a comfortable win to a total loss
at 12-13 conversions (L31 at 8), and 5 of 9 boss finales go with them — L28, L32
and L24 to outright losses, L20 8→1, L36 7→1 — while all-Minigun is never worse
than baseline anywhere and is sometimes far better (L36 7→14, L20 8→12). The
cause is **overkill**: Sniper lands 85 a shot every 2.2s, but **30 of the 42
non-boss bodies have less hp than that** (median 34, L26's housekeys 16), so its
real kill rate is 0.45/s against the tier-3 dart's 1.43/s — a 3.2× loss, exactly
inverted from the 47.3-vs-34.3 `dps` the tower panel advertises. The shipped "no
tier-4 DPS downgrade" guardrail passes because it measures paper DPS. **The
numbers are not the bug** — Sniper is the anti-tough option and genuinely wins
L12 (4,2,4,2 → 12,10,12,10) and L16 (3,4,4,4 → 20,20,20,20) — the SILENCE was:
the button showed a name and a price, the guide covered lines and powers and
never mentioned branches, and the only number pointed the wrong way. Every branch
now states its ROLE where it is chosen and in the guide (derived from the data,
so a ninth branch documents itself), with a derived overkill law: a
single-target branch that one-shots >60% of the roster must say it is wasted on
small bodies. Re-tuning the damage was deliberately NOT done — that re-tunes 36
levels, which the threshold-domination findings say the data will not support.
Three method lessons: **an "observation arm" must be a strict SUPERSET of the
shipped oracle or it measures nothing** — the first cut bought a 260-gold branch
whenever it could not afford a 70-gold tower, starving placement, and the
"stronger" build lost 17 lives on a level the oracle clears at 20/20, which
looked exactly like a finding; **a splash branch is exempt from the overkill law
on physics, not by name** — the law's first cut flagged Big Bertha (105 dmg,
34/42 bodies) and that would have been a FALSE warning, because a shell applies
its damage to every body in the radius; and **a mutation that does not mutate
proves nothing** — two of five mutation checks "passed" because the search string
used a real em-dash while the file carried the JS escape `—` from a python
heredoc, so the replace silently no-opped. Check the byte count changed before
believing a mutation result.

**The THREAT-SHAPE pass on the flat levels: the healer is the first lever that
has ever moved one, and the step function is confirmed for the eighth and ninth
time.** Baseline, 8 seeds on normal: **12 of 36 levels finish 20/20 on every
seed** and every level that costs real lives has a boss. A per-trait audit of
each level's late waves found the opening: **`heal` appears on exactly ONE level
in the whole campaign (L4, 18%)** — the only counter shape that is essentially
unused — and unlike everything already refuted it is a **DPS-THRESHOLD** shape
rather than an HP pile, so a board that cannot out-damage the mending never
finishes the wave. It works, hard: 6% of late-wave HP takes L26 from a flat 20
to 7/3/7/LOST. Three constraints shaped the shippable form, each found by
measuring: healers **mend each other**, so effective HP scales super-linearly
with count (a full-for-full swap puts 13-21 on a wave and L31 loses on normal at
every seed); **every late wave of every flat level already carries exactly one
special**, so `W5 wave composition` forbids ADDING a healer anywhere — it can
only REPLACE; and the dose-controllable legal form is therefore *swap the
special for a SMALL healer group and return the reclaimed HP to the fattest
backbone group*, which preserves total wave HP, RAISES the ≥70% backbone share
and keeps the special count at 1, so all three contracts hold by construction.
**Shipped: L19 w12 (×4), L25 w12 (×5), L30 w13 (×5) and L34 w10 (×3)** — the dose is per
level, and the search now covers every (wave, dose) rather than three sampled
waves, which is the only reason L30 was found at all. **CORRECTION (re-measured
2026-08): L19's normal column recorded here as `20,16,20,20,20,20,20,17` is
WRONG — the shipped `tools/td-sim.js` on those exact 8 seeds gives `20 ×8`, and
the test harness independently agrees. The 16/17 appear on seeds 3 and 19, which
are not in that set, so the vector was written against a different seed list.
The DART column is confirmed in magnitude (~18 undosed → ~10 dosed), and that is
the dose's real effect** — L19 punishes the dart swarm rather than moving
best-of-plans lives, exactly as the "what this buys is not lives-remaining but
build diversity" note below says. heroic median 15 → 16 with zero losses,
dart-mono 19,16,17,18,18,16,16,19 → 11,6,9,10,9,11,8,11 — it is the dart swarm
this punishes. L25: normal 20×8 → 20,20,16,15,20,20,20,20, heroic median 14 → 6 with
zero losses, dart-mono 14,14,14,14,14,13,15,16 → 8,8,8,8,9,8,11,9. Neglect
still loses both. **FIVE doses were built, measured and then
REJECTED, and each rejection is a rule.** (1) **L31 w12 measured beautifully and
still broke the build, because L31 CARRIES A LEVER** — `TD7 lever advantage`
requires a thin 9-pad board to LOSE on the short route and WIN with the diversion
thrown, and making the level harder made that board lose on BOTH (short 0 →
lever 2, against a ≥6 contract). **A difficulty change on a fork level is also a
change to that fork's reason to exist**, and five of the twelve flat levels are
forks (L7, L19, L23, L27, L31) — dose the non-fork ones or re-verify the lever
after. (2) **L26 w12 ×3 looked safe on 4 seeds (heroic 6,3,7,5, zero losses) and
loses heroic on 3 of 8** (…,1,−1,−1,−1). That is the documented "8 seeds is the
minimum honest sample" law catching a dose that was one commit from shipping.
(3) **L30 w12 ×3** moves normal only 20 → 18-20 while taking heroic from median
11 to a MINIMUM of 1 — nearly unwinnable on some seeds is a coin flip, not
difficulty. And **L23 has no safe dose at any count** (×2 loses one heroic seed,
×3 three, ×4 two), corroborating the recorded finding that it is unmovable.
L26 is the sharpest statement of the step function yet: at 3 healers normal is
20,16,20,20 and heroic *appears* to survive; at 4 normal finally GRADES
(15,15,15,15) and heroic loses 3 of 4. There is no dose in between. Two facts
worth keeping: **wave POSITION matters more than dose** — on L26 only w12
responded at all and w11/w13 were inert at every count — and what this buys is
not lives-remaining on normal (nothing buys that) but **build diversity**, since
it roughly halves what a dart-only board keeps. Putting the healer into a new
world also collided it with the Battery Bot at colour distance 0.0 (same antenna
blue) — the same-pool colour guardrail caught it, the antenna is green now, and
note the trap in fixing it: **that scan reads source TEXT, so naming the old hex
in the explanatory COMMENT re-created the clash.**
One method note: the first doser drained
whichever group was fattest, which can be the FLIER group — that would have
silently deleted the anti-air property the `AUDIT threat shape` law protects, so
a doser must exclude the shapes the contracts depend on, not just the ones it is
adding.

**A ROSTER-PRESENCE measurement, recorded because `AUDIT roster` proves an
enemy is REACHABLE and says nothing about whether it is ever MET.** Measured as
each type's share of total campaign HP and the number of levels it appears on:
**`blob` (18.1%) and `knight` (15.8%) are a third of the entire campaign**, and
knight appears on **36 of 36 levels** — the per-world backbone SKINS fixed the
four ground backbone types but these two were never skinned. At the other end,
**`brick` is a declared member of `BACKBONE_TYPES` and appears on ONE level at
0.043%** — it is load-bearing in the ≥70%-backbone composition contract while
being effectively absent from the game — and `bull` sits on 2 levels at 0.154%.
`duck` at 0.126% over 3 levels is consistent with its already-recorded "worth
zero lives, shipped for legibility" result, and `mudlet` at 0.000% is CORRECT
(it is the Mud Blob's split child, which the roster audit already counts as
reachable). No change was made: raising a barely-present type's share is a
balance edit that the budget and composition contracts constrain, and it must be
measured per level like every other dose. Recorded so the next author starts
from the distribution rather than re-deriving it — and note the shape of the
gap, which is this project's recurring one: a test that proves something CAN
happen is not a test that it DOES.

**A WALL-CLOCK assertion in a suite that also runs balance sims cannot be
fixed by a better statistic — it has to stop measuring the machine.** The frame
-budget guardrail failed three times today on commits that touch no render code
at all. It averaged 50 draws and asserted the MEAN: `npm test` is bare
`node --test`, which runs the test FILES concurrently on 4 cores, and the
PLAYABILITY sim alone burns 248s of CPU, so one descheduled slice dragged it
(17.82 ms against a ~3.5 baseline, 3/3 green in isolation). Switching to the
MEDIAN was the documented interleaved-medians lesson and it still failed at
14.60 ms — because under real starvation EVERY draw is slow and the median
rises with them. What the test actually guards is the PER-ENEMY cost of the ink
line, so it now measures exactly that: the same draw with the crowd and with
the crowd removed, INTERLEAVED in one window, asserting their RATIO. Both arms
are slowed equally by contention, so the ratio is not. Measured 2.48× (crowded
6.70 ms vs empty 2.70 ms) against a bound of 6, and a 5×-cost mutation takes it
to 15.59 → red. A loose absolute bound (60 ms) is kept only for the failure a
ratio cannot see — the floor itself going catastrophically slow. **The general
rule: a performance guardrail must compare against a control measured in the
same conditions, never against a constant, or it is a test of how busy the box
is.** And the same pass widened `AUDIT heroic is a SLOPE` from ONE seed to
{1, 7, 13}: a single seed is not a sample, the threat-shape work built two doses
that were clean on four seeds and lost heroic on eight (L22's on seeds 1 and 3,
L26's on 11/13/17/19), and the record already carried an L30 that lost on seed 5
while green on 7 — the chosen set is the one that catches BOTH. A full 8-seed
sweep of all 36 levels was run FIRST and passes, so it is a strengthening rather
than a newly-blocked build; it costs ~2 min on a ~25 min gate.

**A level that costs the SAME on every seed is as untense as one that costs
nothing — the flat-20 metric was hiding half the problem.** Re-baselining after
the threat-shape doses, `L21 Boxes by the Door` reads **19 on all 8 seeds**:
spread 0, exactly one life every time. That is the identical shape the additive
mini-boss turned out to be (a disguised constant), just at a different offset —
the player's build cannot change the outcome, so the level asks nothing, and no
"flat 20/20" search would ever look at it. The right metric for "does this level
ask a question" is SPREAD across seeds, not the median: by that measure the soft
set is larger than the twelve levels the first pass targeted (L34 moves on 1 of
8 seeds and only by a life; L33 on 2). Recorded rather than acted on in the same
breath, because widening the target set is a measurement job for
`tools/td-threat.js`, not an assumption — but the next author should search on
spread.

**A `str.replace` with no assert is the em-dash mutation trap wearing a
different hat.** Updating this file after the L30 dose, one of two edits
silently no-opped because the target text had been reflowed by an earlier edit —
so the learnings block said three doses had shipped while the open-items block
still said two, and the working tree was CLEAN and the commit went green. It was
found by grepping for the new text rather than by anything failing. The rule is
the same one mutation testing teaches: **after a scripted edit, verify the
change is PRESENT, not just that the script exited 0** — `assert s.count(old)==1`
before replacing, and grep for the result after.

**A NEGATIVE result is only as good as the coverage behind it — twice in one
pass a search reported "nothing here" that was really a property of how the
search chose what to look at.** First, sampling three waves per level instead of
the whole (wave × dose) grid: that is how L30 was written off, and the full grid
then found w13 ×5 with a comfortable margin. Second, and worse because it looked
principled: `tools/td-threat.js` screened on 4 seeds and then 8-seed-CONFIRMED
only the three candidates with the strongest normal movement. On **L34 — the
softest level in the campaign** — every aggressive candidate blows out heroic,
so all three failed and the tool reported no safe dose, while the mild ones that
actually survive were never tested. The gentlest dose that still moves a level
is what you want, not the biggest, so it now confirms strongest / middle /
weakest. L34 w10 ×3 shipped from that fix and is the strongest result of the
set: 7 of 8 seeds move (20,19,20,20,20,20,20,20 → 17,19,17,20,20,15,19,16),
heroic median 11 → 6 at minimum 4 with zero losses. **A THIRD flaw in the same instrument, and the worst kind — a criterion a NO-OP
satisfies.** Re-running L33 with the selection fixed produced two 8-seed
"PASSES" whose normal line was `20,19,20,20,19,20,20,20` — byte-identical to
L33's own BASELINE. The screen was `!nn.every(x => x === 20)`, which only means
"the dose did something" on a level that starts at a flat 20; L33 starts with
two 19s, so a dose that changed nothing sailed through. It now measures the
level's own baseline first and requires a candidate to cost strictly MORE than
the untouched level. That is the same defect as a test that cannot fail, wearing
the search's clothes — and it is the third time in one pass this tool reported
something confidently wrong (sampled waves, aggressive-only confirmation, and
now a no-op-satisfying criterion). **The FIX then produced a fourth**: the
baseline was computed over the 4-seed screen while the confirm arm runs 8 seeds,
so an 8-element sum was compared against a 4-element one, it is always larger,
and every candidate reported FAIL — including one with zero heroic losses. Each
arm computes its own baseline now. Four wrong answers from one instrument in a
single pass, every one of them plausible-looking, is the argument for treating a
measurement tool as code that needs its own adversarial reading: **compare like
with like, and be suspicious when a fix makes everything fail as neatly as the
bug made everything pass.** **Before trusting a
"nothing here", ask what the search was allowed to see** — and note which
earlier negatives the fix invalidates: L22 is unaffected (no candidate passed
even the screen) and L26/L35 had ≤3 candidates so all were confirmed, but L33's
verdict came from 14 candidates of which only the 3 most aggressive were tested,
so it had to be re-run.
**And the re-run produced a FIFTH flaw in the same instrument, which is the one
worth generalising: a search must rank on the axis that BINDS, not the axis you
want to move.** Every rejection this doser has ever produced was a heroic loss —
never a normal one — so heroic is the constraint and normal movement is merely
the objective. Both previous selections sorted by NORMAL: the first took the 3
strongest movers (so on L34 every candidate tested was one that blows out
heroic), and the "fix" took strongest/middle/gentlest (so on L33 it confirmed a
dose with heroic min **1** while the three candidates with heroic headroom
**4-5 were never run at all**). Ranked by heroic headroom, L33's answer appears
immediately and is better on BOTH axes than anything the old order tested —
w12's slime group → **3 Junk Healers**, normal 20 → 16,18,18,18,16,16,17,16 with
heroic 9,5,5,9,2,7,6,2 (min 2, the floor shipped L29 already sits at) and
dart-mono still clearing every seed. Five wrong answers from one instrument, and
the shape of the fifth is: **when a search has a hard constraint and a soft
objective, sorting by the objective hides the feasible region.**
**The bigger find is the TARGET LIST, and it was wrong in a way no amount of
searching would have fixed: `SPREAD=1 node tools/td-threat.js` now derives it.**
The flat-level work had been aimed at levels finishing 20/20 on every seed — but
a level reading **19 on all eight seeds** (L21 does) is exactly as much a
disguised constant: the roll changes nothing, so the level asks no question, it
just charges a fixed toll. Measuring min/median/max/spread over 8 seeds for all
36 levels says so directly, and it named **six levels that had never been
searched at all** — L1, L2, L5, L14, L17, L21 — of which four (L5 19, L14 19,
L17 19, L21 19) are invisible to a flat-20 criterion by construction. L1/L2 are
World 1's tutorial and stay flat by design. The same scan re-derives things this
file previously recorded as separate findings, which is the argument for keeping
it as a mode rather than a memory: L11 reads **spread 0 at median 15** (a
different pathology — a real cost, but the seed is irrelevant), L16 reads
**spread 14 (6→20)** which is the boss quantization stated as a number, and
World 3 is still the hardest world. **Spread, not the value, is the signal** —
and the flat-level list must never again be a remembered one.
**A hand-seeded exception inside a DERIVATION is the same defect as a
hand-written scan list, and `BACKBONE_TYPES` had one.** It correctly derives from
every world's declared `backbone`, then seeds `["brick"]` before the loop — and
the comment justifying that seed claimed brick was "on every world by design".
Measured: brick is authored on **exactly one level (L2), in one world of nine**,
and otherwise only ever arrives as the Bolt Bucket's spawner drip, which the
wave-budget audit cannot see at all. The comment was fixed to the measurement.
The real risk is what the seed GRANTS: anything in it collects backbone credit
without a world declaring it, and the composition contract is "≥70% backbone,
≤1 special at ≤25% HP" — so seeding a mechanic-carrying enemy would reclassify a
special as backbone and let a wave ship two disruptive shapes with no answer,
the exact failure that took World 4 from 2/4 to 4/4 when it was fixed. `P2
identity` now derives the declared set and requires every seed to be VANILLA
(no armor/shield/resist/phase/heal/spawner/… field). Mutation-proven by seeding
`ghost` → red naming `phase`; seeding `knight` correctly stays GREEN, because
knight IS declared by every world and so is not a seed — that is the guardrail
scoping right, not a hole in it.
**Widening the search produced the criterion the whole exercise had been
missing, and it is read off the shipped STAR LADDER rather than invented: a dose
must MOVE the star outcome and must not ERASE it.** "Costs strictly more than
baseline" turned out to be too weak on one side and silent on the other, and
each half cost a real measurement. Too weak: **L17 w11 passed while costing 2
lives across ALL EIGHT seeds** (0.25 a seed — noise) with 3★ unchanged at 8/8,
so nothing a player experiences changed while heroic was taxed for free. Silent:
**every L5 candidate** took a reliable 18-19 to **12-15 on 8 of 8 seeds with the
spread unchanged at 1-2**, so 3★ became UNREACHABLE — not a question, a strictly
WORSE constant, i.e. the additive mini-boss result (spread 0 at every hp)
wearing a threat shape. With `stars` = `[[18,3],[10,2],[1,1]]` the line derives
itself, and the two bounds (`stars3 < baseStars3` and `stars3 > 0`) agree with
**all 13 measured candidates, zero disagreements**: every shipped dose lands at
3-7 of 8 from a baseline 8 of 8, and every rejected one is either 0/8 or an
unmoved 8/8. That is a separation, not a fence.
**And L5 is a REJECT for a second, independent reason: a level whose DIFFICULTY
IS A PINNED PROPERTY must be skipped,
which is the fork rule generalized.** L5 is one of the two levels `AUDIT mono
builds` uses to prove no single plan clears the campaign ("heroic L5 must defeat
a dart-ONLY board … and reward a mixed one"), so changing it changes the thing
it exists to demonstrate — exactly why L31's beautiful measurement broke `TD7
lever advantage`. That fact lives in the TESTS, not the data, so it cannot be
derived: `PINNED` is an explicit map (L4, L5, L8) where each entry NAMES its
pinner and the tool prints why it skipped.
**That third signal turned out to be the decisive one, and it is now the fourth
rule: a dose must buy BUILD DIVERSITY, which is what these doses are FOR.** This
file already states the purpose plainly — "what this buys is not lives-remaining
on normal but build diversity, since it roughly halves what a dart-only board
keeps" — and it was being eyeballed rather than checked, so a candidate could
pass every numeric gate while leaving a dart swarm exactly as good as the best
plan. Counting the seeds where the mixed plan beats dart-only separates every
dose the search has produced with nothing in between: **L19 8/8, L25 8/8, L30
4/8, L33 4/8 and the new L21 8/8 — against L14 w10 and L5 w6 at EXACTLY 0/8**.
It is what settles **L14, whose w10 dose passed the star bounds and is still
REJECTED**: L14 is simply a dart-favouring level (its baseline dart column
equals best-of-plans too), so the dose would have paid heroic min **6 → 2 on
three of eight seeds** to change nothing about what you build.
**And the widened search's real prize was L21 — the flattest level in the game.**
It read **19 on all eight seeds, spread 0**: a fixed toll no build could move,
and precisely the shape a flat-20 criterion could never see. Its w12 slime group
becomes 3 Junk Healers (845 hp back to the blobs, 33 → 47, wave hp −0.10%,
backbone 95.1%): normal **14,16,15,19,19,19,14,19** (spread **5**, 3★ 8/8 → 4/8),
heroic **6,6,7,4,3,6,3,8** — min 3 against a measured baseline min of 7, no
losses — and the mixed plan now beats a dart swarm on 8 of 8 seeds by 40 lives.
It was also the only one of L21's four confirmed arms with any heroic headroom
at all (the other three all bottom out at 1), which is the heroic-headroom
ranking earning its keep on the very next level after the one that motivated it.
**The diversity rule then became a GUARDRAIL, at zero extra cost, because the
dose-lock test was already computing both plans and throwing one away** — it
kept only `Math.max(dart, mixed)`, so the gap it needed was being discarded one
line before it was wanted. Three things about it are worth keeping. **Measure
before you assert:** L4 scores **0/4** (dart 14,14,14,13 vs mixed 3,4,3,3), so
asserting over every healer-bearing level would have gone red on shipped content
at once; it is excluded by a DERIVED condition (`waves.some(w => w.boss)`)
rather than a hand list, and the exclusion is principled because `AUDIT mono
builds` separately pins L4 as the level that must DEFEAT the mixed plan — two
tests demanding opposite things would be a contradiction, not coverage. **The
obvious mutation does not isolate it:** killing the healer (`hps: 15 → 0`) fires
the older "still finishes 20/20" assertion first, the same redundant-fix trap
that made the price-flash guardrail unfalsifiable earlier in this session. It is
proven instead by collapsing the INSTRUMENT (mixed plan → `["dart"]`), which
fires exactly this assertion with the lives checks still green — and the honest
caveat is recorded in the test, because a product-side mutation that removes the
diversity without also removing the dose's effect does not exist: **the
diversity IS the dose's effect.** Shipped margins: L19/L21/L25/L34 4/4, L30 2/4,
L33 1/4.
**The spread scan's other output was a REACHABILITY question, and it is closed:
🏆 Full Fort is earnable.** The scan's max column shows the shipped oracle never
3-stars **11 of 36 levels** (3★ is 18 lives of 20), which matters because
`fullfort` requires EVERY star — the same "a feature nothing can select is dead
content" class as unreachable heroic and World 4's cardless levels. Measured
rather than assumed, and the answer is layered, which is good design rather than
a defect: seven of the eleven are boss finales; **L10** is a fork the oracle
never levers; **L13** 3-stars 8/8 the moment you take a tier-4 BRANCH (17 →
18-20); **L9 and L11** need branches AND Extra Hearts I+II (0/8 → **8/8**, 19-21);
and every remaining case — including L20, the worst at a max of 10 — 3-stars
**4/4 seeds at 24/24 lives** on casual with the full tree, which counts because
`bestStarsOf` takes the best across the three ladders. So the meta layer is
load-bearing: a handful of levels are deliberately gated behind investment, and
the completionist path exists. **No guardrail was added, deliberately** — the
margin on the hardest finale is 6 lives (24 against a threshold of 18), so a
threshold test there could not realistically fail, and this file's own rule is
that a test which cannot fail is worse than no test. It also uses a solver
stronger than the shipped oracle, which is fine as a DIAGNOSTIC and must never
become a tuning target.

**Three real-play reports in one message, and the through-line is that each was
INVISIBLE to a test that was already passing.** (1) **A `title` is a HOVER
affordance, and this game is played on a phone** — the ⚙️ Toy Energy exchange
rendered as `⚙️ 0` with its gold price only in `title`/`aria-label`, so a buy
button never said what it cost until after you had pressed it ("buying extra
gear doesn't specify cost"). That is the THIRD instance of the class: TD-12
found the abilities' NAMES living only in an aria-label, then ⚙️ itself shipped
as a bare numeral nothing explained. The proximate cause is worth knowing
because it will recur: `charge.textContent = "⚙️ " + n` is a WHOLE-NODE write,
so it erases any sibling you add beside the number — which is exactly why the
price had nowhere to go but the title. Split the node first, then the price can
be ink. Guardrailed twice: structurally, and by a browser test that drives the
real HUD and READS THE BUTTON, because "the code exists" and "the player can see
it" are different claims. (2) **When a layer cannot be VERIFIED, add a second
one that works by a different mechanism.** Double-tap zoom was reported on CALL
/ RUSH and the ⚙️ button although `touch-action: manipulation` was already
declared page-wide, on `.td-screen` and on every control — and it intersects
down the ancestor chain, so on paper the gesture was already dead. WebKit is not
installed in the dev sandbox, so Chromium can neither prove nor disprove it.
So the containers declare it too (the 8px gaps BETWEEN buttons are the one
surface a fumbled second tap lands on that is not a button), and a `touchend`
guard calls `preventDefault` on a second tap within 350ms, killing the gesture
at source. Two details decide whether that guard is real: it needs
`{ passive: false }` or `preventDefault` is ignored SILENTLY (a guard that looks
present and does nothing — the guardrail asserts it), and swallowing the second
tap is the POINT rather than a cost, because every control it is applied to
already treats a doubled press as a fumble (`RULES.rushSettle` exists for
precisely that). (3) **Sticky Bomb's goo was a sentence.** Its own role text
says "the goo it LEAVES slows whatever WALKS IN"; the code only slowed bodies
caught in the blast at the instant of detonation, so nothing lingered, nothing
could walk in, and there was nothing on the ground to draw — the whole identity
of a 300-gold branch was its description. The documented "a named mechanic must
BE that mechanic" class (四宫数独 was a Latin square). The fix routes it through
`state.puddles`, the ONE lingering-ground-effect path the 🍯 Sticky Floor
ability and the 🛢️ Oil Drum's spill already share, so it inherits the slow
application, the `isHidden` gate, expiry, checkpointing **and the renderer** —
the picture came free, which is the argument for the shared path over a new
field. Measured 450 ticks of goo from one branch over a wave; determinism is
untouched because no oracle plan buys tier-4 branches, which is also why this
cannot move a winnability sim.
**The method that generalises from (3): diff the EMITTED EVENTS against the
renderer's dispatcher.** Of 25 event types the engine emits, nine had no visual.
Most are legitimately owned by another surface (the HUD, the wave banner, the
defeat screen), but two were real holes and both were invisible to every
existing test: **`soldier-down` drew nothing**, so army guys vanished mid-fight
— and the Vacuum King's ENTIRE kit is KO-ing soldiers, so the boss's signature
move read as nothing happening (now a grey dust puff, deliberately NOT the gold
`stars` a kill uses: losing one of your own bodies must not look like scoring
one); and **`sell` drew nothing** while `build` and `upgrade` both ring, though
the event already carried the refund to float. When you next wonder whether the
game FEELS complete, enumerate the events and ask which have no picture — it is
a cheap, mechanical audit that a tap-harness can never perform.
**A PUSH DID NOT TRIGGER A DEPLOY, and the only thing that caught it was the
owner opening the site.** `02312d2` was on `origin/main`, the full suite was
green, and nothing was wrong with the code — but GitHub created NO workflow run
for that push, so the live site simply kept serving the previous commit. Every
earlier push the same day had triggered normally, which is what made it hard to
believe. The tell is unambiguous once you look for it: `list_workflow_runs`
filtered to `status: in_progress` returned 0, `queued` returned 0, and the
completed list's newest entry was the PREVIOUS commit — three cheap, small,
uncached queries that together mean "no run exists", as opposed to "a run is
pending". Do not diagnose this from the unfiltered listing: it returns ~428KB
and a byte-identical payload on repeat calls, so it looks stale whether or not
it is, and reading it as a cache is what delayed the diagnosis here.
**The fix takes seconds, because `deploy.yml` declares `workflow_dispatch:`
alongside `push`** — trigger it with `actions_run_trigger` / `run_workflow` on
ref `main` and the same three jobs run against the head commit (test → deploy →
verify-live, all green, live site confirmed). Two lasting points. **A green
local suite and a pushed commit do NOT mean the site is live**; RULE 6 already
says a change is done only once the deploy is watched, and this is the failure
mode it exists for — the deploy can be missing rather than broken, which shows
up as silence, not as red. And **when a user says the live site looks stale,
believe it over your own reading of the API**: that report was the evidence that
overturned the cache theory, and it was right.
**"TAIL WIND WIPES THE BOARD AND THINGS WENT CRAZY" — and the diagnosis was in
the DRAW ORDER, after six probes had failed to reproduce it.** The screenshot
showed no towers at all, orange circles stacked down the lane and a big cyan
cone, while the HUD kept counting waves. The cause was a one-word slip in the
commit that shipped the branch: the support-link overlay called `w2s(...)`,
which is not in scope inside `draw()`, so a `ReferenceError` fired on EVERY
frame the moment a Tail Wind existed, aborting the frame at that exact line. Map
that against the draw order and it predicts the picture precisely — floor,
puddles (the amber circles), zap beams (the cyan) all come BEFORE it; towers,
soldiers, enemies and projectiles all come after; and the HUD is DOM, so it
carries on regardless. **When a canvas frame is partly drawn, the draw ORDER
tells you where it stopped** — that is a faster diagnosis than any repro, and I
reached for it last instead of first. The other reason it looked unreproducible
is the one worth the most: **I was probing code that was already fixed.** The
slip shipped in `856bd16`, was corrected in `5b43fc7` an hour later, and the
player was on the older deploy — so my sandbox was faithfully showing me a
working board. **Check which COMMIT the report came from before concluding
"cannot reproduce".** The hardening shipped anyway, because the real lesson is
systemic: that block also mutated shared canvas state (`strokeStyle`,
`lineWidth`, a line DASH and `lineDashOffset`) and reset only the dash array,
and `draw()` had no guard at all — so it is now `save()`/`restore()` in a `try`,
a `finally` resetting both dash fields, and a `catch`, because **a purely
DECORATIVE overlay must never be able to abort the frame that draws the towers.**
Four method lessons, three of them about my own instruments. (1) **The GATE must
be read inside the `try`** — the first cut left `if (st.hadSupport)` in the
condition, so a throw reading it still escaped and still cost the board; the new
guardrail caught exactly that, which is what it is for. (2) **A probe that hashes
a LIVE frame is measuring the rAF loop, not the code** — three runs of an
unchanged file gave three different hashes, because the loop keeps ticking the
engine between processes. Hand-place the bodies and PIN `state.tick` (the ring's
phase and the bob are both tick-derived) and it goes byte-stable. My first A/B
"found" a difference that was pure noise. (3) **A `noInk()` wrap I added was DEAD
CODE, and measuring said so** — the strip ring sits outside `withInk`, so
`inkDepth` is 0, and `withInk`'s `finally` has already zeroed `inkBudget`; the pen
cannot fire for two independent reasons, and the pinned-tick A/B renders
byte-identical with and without. Deleted rather than shipped, per the
bed-glyph-clamp precedent. (4) **A bound must be measured against the thing it
claims to catch.** My new assertion said the board must still paint "essentially
the same" when the decoration fails, at `< 20000` px — but the decoration failing
costs **351** px while the tower pass genuinely not running costs **11,884**, so
the bound sat ABOVE the defect and could not have failed. It is 3000 now, and the
assertion is ordered BEFORE the "nothing escaped" one so the same mutation proves
the stronger claim. Writing a guardrail for someone else's bug is no protection
against writing an unfalsifiable one.
**THE COVERAGE HOLE BEHIND IT: the fort suite DOES assert no page errors, and it
was green anyway, because nothing ever put the new branch on a board and drew
it.** The tier-art guardrail renders each variant in ISOLATION, so it cannot see
a throw in `draw()`'s own composition, and the only test that built one on a live
board was written in the SAME COMMIT as the fix — which means the EIGHT original
tier-4 branches had never been drawn through a real frame either. Two things
close it, and the first is the subtle one: **a `catch` added for robustness will
hide from the suite exactly the class of bug it exists to survive**, so the catch
now RECORDS what it swallowed and exposes it via `render.decorInfo()` (the
shakeInfo/leverInfo precedent) — robust for the player, loud for the developer.
On top of that, a guardrail DERIVED from `DATA.TOWERS` builds every line x every
branch on a live board, runs a wave, draws across a spread of ticks and asserts
no throw, no `decorInfo` and no page error, so a ninth branch inherits it when it
exists rather than when someone remembers. **And that guardrail's FIRST cut was
itself vacuous, caught only by running the mutation** — it placed on
`pads.slice(0, 2)`, which on L1 are 5.0 cells apart against the 4.5 support
radius, so neither tower buffed the other, every tower failed the `supRate > 1`
check, and the link loop `continue`d before ever reaching the line that used to
throw: re-introducing the historical `w2s` bug left it GREEN (a sibling test
caught it, which is what exposed the hole). The pads are chosen by measured
distance now, and the hook is read with no `? :` fallback, because a missing hook
must fail loudly instead of silently skipping the check. Same shape as the
original defect one level up: **the fixture never created the condition.**

**THE TIER-4 BRANCH AUDIT: every branch earns its gold, and the thing that is
actually missing is WHERE to put it. Two of my own headline findings in this
one audit were artifacts of the instrument, both caught by testing the
instrument instead of trusting it.** The question — is each of the 10 branches
ever worth its 260-300 gold? — was open because both oracle plans fill with
`t.tier < 3` and never call `branch()`. The first sweep (9 boss finales, 8
seeds, normal, convert 1) said **Sniper Scope +20 lives and every other branch
between -1 and +2**, i.e. seven decorative ultimates, several actively harmful.
That reading was WRONG, twice over. (1) The headline is `max(DART, MIXED)`, and
a branch can only move the plan CONTAINING its line, so the max can hide an
effect or misattribute a drop — `PERPLAN=1` splits it and showed L12's 7 -> 5
was real (the winning mixed plan fell) rather than an artifact, which is the
half that survived. (2) The fatal one: the arm converts the FIRST eligible
tier-3 in pad order, and for a positional branch the pad IS most of the value.
`BRANCHPAD=n` makes the choice a variable, and on **L20 every single branch is
POSITIVE at its best pad** — Sniper +12, Bertha +5, Static/Tail Wind/Rust Ray
+3, Blizzard/Sticky +2, Minigun +1 — against a control of 8. The placement
swing is enormous and is the finding: **Sniper reads 15 at one pad and 20 at
another, Bertha 10 vs 13, Tail Wind 8 vs 11 — up to 5 lives from WHICH tower
you convert, which is more than most branches' entire headline value.** So the
branches are not weak and do not need re-tuning (which the threshold-domination
results say the data would not support anyway); what the game never tells you
is where to put one. The tower panel states what a branch DOES and nothing
about where it works, and the Toybox Guide's branch roles are level-agnostic.
That is the actionable gap, and it is an INFORMATION fix, the same call already
made for Sniper's overkill. Two limits stay on the record: **Dino Squad and RC
Racers remain unmeasurable**, because neither oracle plan builds a camp (the
same structural hole that made Rally Horn inert in every test), and this sweep
is normal-only — heroic is the binding axis and has not been run. Also
reconfirmed: L4 and L8 contribute nothing because the board never reaches
full-and-maxed there, so tier-4 is a late-campaign feature; and L12 is a level
where no branch helps even at its best pad (Sniper is -2 at every pad, exactly
as the shipped overkill law predicts for a board full of small bodies), which
is branches being situational — the design working, not failing. The
generalizable rule, now paid for twice in one sitting: **when an instrument
makes a CHOICE the player would make, that choice is a variable, not an
implementation detail** — sweep it before believing any null result.

**The branch audit's two recorded gaps are now CLOSED, and closing them
produced the strongest result of the whole exercise: on HEROIC the ranking
INVERTS.** L20, best pad per branch, control 12 lives: **Sniper Scope goes from
+12 on normal (the one branch clearly worth buying) to -4 on heroic (the one
that hurts most)**, while Minigun goes from +1 to +2 and is the best pick there;
Rust Ray, Blizzard and Static Zap are flat 0; Bertha -1; Sticky and Tail Wind
-2. So the correct branch depends on the LEVEL and the DIFFICULTY, which is
conclusive for the information fix and fatal to any re-tune: there is no set of
stat numbers that makes a branch right in both places, because the same branch
against the same map is right at one hp multiplier and wrong at another.
**The camp branches are measurable at last, and both read a clean NULL** —
`PLANS=camp` runs a camp-inclusive board for control AND branch arms, and on
L20 Dino Squad and RC Racers are byte-identical to their control on all 8 seeds
at every pad, with `bought=8` proving the purchases landed. That is the exact
signature the four earlier fixture bugs produced, so note what separates it: the
camp board is genuinely stronger than the oracle's (control 11 vs the mixed
plan's 8), so camps ARE contributing, and `blocks: 2` and the RC stun are
separately driven live by `TD2 Army Guys` in the engine suite. The honest claim
is therefore narrow — on L20 neither camp branch changes lives — and one level
does not generalize; a plausible mechanism is that L20's leaks come from bodies
soldiers cannot block at all. **An ANOMALY is recorded rather than explained:
heroic L20 finishes with MORE lives than normal L20 under the shipped oracle
(control 12 `[12,14,14,12,12,12,12,12]` vs 8 `[10,10,8,8,8,8,8,10]`)**, which is
backwards for a difficulty whose whole definition is hp x1.30 and bounty x0.9.
It reproduces on all 8 seeds and was verified against raw output rather than a
parse. It is out of scope for a branch audit and is NOT a claim that heroic is
mis-tuned — but it is the kind of thing that, left unwritten, gets re-discovered
as a bug. Worth one focused look.

**TWO LEVELS WERE UNWINNABLE ON HEROIC AT SEED 23, AND THE TWO NEAR-MISSES
FIXING THEM ARE WORTH MORE THAN THE FIX.** Found while chasing something else:
`AUDIT heroic is a SLOPE` drives seeds {1, 7, 13}, and **L21 and L30 both LOSE
on heroic seed 23** under the same best-of-two oracle, so the contract "every
level stays winnable on heroic" was false while the suite was green. **The
cause is the healer dose, measured rather than guessed** — removing only the
healer group takes both from 1/12 losses to 0/12 and lifts heroic medians
5.5 → 11 and 8 → 11.5. Healers are **4.9% of wave hp** on each and decide the
level, which is the already-documented super-linear mending: they heal EACH
OTHER, so a count that is nothing as hp is everything as effective hp, and it
can flip ONE seed while eleven others are comfortable. **The two levels needed
OPPOSITE levers, so no single fix would have done:** L21 took `startGold
1200 → 1275` (heroic 1/8 → 0/8, median 6 → 8, floor still 4, and the dose keeps
working untouched — normal 3★ stays 3/8, diversity 8/8; 1275 is minimal, 1350
takes heroic to median 11 and goes soft), while on L30 **gold is completely
inert** — 2050/2150/2250/2350 all still lose seed 23 and move normal by zero —
so it took `w13 healers 5 → 3` with `carton 136 → 141`, wave hp EXACTLY
preserved at 8619 (heroic 1/8 → 0/8, diversity 5/8 fully kept, where reverting
the dose outright would drop it to 3/8). Guardrail widened to {1, 7, 13, 23}
and proven BOTH ways: red on the pre-fix data naming L21 and seed 23, green
after. **NEAR-MISS 1, the important one: the obvious repair was HOLLOW.** Dose
sizes chosen to satisfy "no heroic losses" failed the other three dose rules —
L21 at 2 healers produces normal `[19,19,19,19,19,19,19,19]`, **byte-identical
to having NO dose at all**, and L30 at 4 drops diversity to 2/8, **BELOW the
3/8 of no dose whatsoever**. Both would have sat in the data file looking like
tuned levels and done nothing. Optimising whichever metric you measured first
is how a no-op passes its own criterion; the four rules (move 3★, do not erase
it, buy diversity, lose no seed) exist precisely because any one of them alone
is satisfiable by a change that does nothing. **NEAR-MISS 2: a shipped balance
RECORD was wrong.** This file logs L21's dose as validated at `heroic
6,6,7,4,3,6,3,8 — no losses` across 8 seeds INCLUDING 23, and the shipped level
loses there. Whatever the reason (a different tool's oracle, or drift after the
fact), a recorded measurement disagreed with the artefact, and only re-measuring
found it — **a balance number in this file is evidence, not proof, and the
cheapest way to check one is to re-run it.** Recorded separately and still open:
**L30's dose never moved normal at all** — flat 20/20 and 3★ 8/8 with or without
healers — so by this project's own rule that a dose must move the 3★ outcome,
one of the six shipped threat-shape doses does not qualify; its real value was
always diversity, which the smaller dose keeps in full. Two smaller lessons.
**My own scan regex silently dropped exactly the rows that mattered** — it
matched numeric seed lists, and a losing level prints `heroic LOST@23`, so the
only two defective levels in 36 were invisible; the 34-of-36 count is what
exposed it, and that is the "a scan's own list is part of the scan" law landing
inside an analysis script. **And a KILLED process and a FAILING suite both exit
non-zero** — the tell is that a real failure writes hundreds of bytes of TAP
output while a kill wrote 22, so check the byte count before reporting a
failure. Closing the item that started this: **heroic is easier than normal on
exactly ONE of 36 levels (L20, +4), with L32 tied and 32 correct**, so the
ladder is broadly sound and L20 is an isolated outlier rather than a systemic
break — worth one look someday, not a re-tune.
**That look happened (2026-08), and the inversion is CONFINED TO ONE PLAN, which
makes it a property rather than a defect.** Split per plan over 8 seeds, L20 reads
dart normal med 8 → heroic med **5** (and an outright LOSS on one seed), i.e. the
correct direction and steeply so; mixed reads normal med 8 → heroic med **12**.
The shipped oracle takes `max(dart, mixed)`, so the headline inverts entirely
because of the fan+mortar arm. Two things follow. The plausible mechanism is an
engine property, not a bug: heroic's `hp ×1.30` makes bodies DWELL longer on the
lane, and a slow-aura + splash board gains superlinearly from that (tankier
bodies clump, and AoE efficiency scales with clumping) while a single-target dart
swarm pays the HP bump as pure cost — so L20-on-heroic is a level where the mixed
build is close to mandatory, which is defensible design. And the obvious lever is
REFUTED: a gold sweep (1070/1110/1150/1190 × 8 seeds) moves normal **not at all**
— it reads med 8 at every value — while heroic only shifts 11→12, so no gold
setting closes a 4-life gap. Recorded rather than re-tuned: changing a shipped
boss finale on a best-of number that the greedy oracle's build ORDER partly
shapes is the World-4 revert's exact shape.

**THE HEALER DOSE HAS A SINGLE-SEED CLIFF, ON THREE OF THE SIX LEVELS THAT
CARRY ONE — and the intuitive repair is HOLLOW on all three.** After fixing L21
and L30 (seed 23), a 36-level × 12-seed heroic sweep with the guardrail's exact
`run()` found exactly ONE more loss: **L25 on seed 2**, also a healer-dosed
level. So L21, L25 and L30 — half the shipped threat-shape doses — each had a
seed on which the level is unwinnable on heroic, and the shipped guardrail's
{1, 7, 13} could not see any of them. The MECHANISM is why: healers mend EACH
OTHER, so a dose sized as a share of wave hp (4.9% on L21/L30) behaves nothing
like that share — it is comfortable on eleven seeds and fatal on the one that
happens to cluster them. A three-seed sample against a failure that lives on
roughly one seed in twelve is not a sample. Fixes: **L21 `startGold 1200 →
1275`, L25 `1000 → 1075`, L30 `w13 healers 5 → 3` (carton 136 → 141, wave hp
exactly preserved at 8619)**; guardrail seeds **{1, 7, 13} → {1, 7, 13, 23, 2}**,
each addition proven RED on the pre-fix data naming the level and seed by name.
**THE LESSON THAT GENERALISES, and it caught me three times out of three: on
every one of these levels the obvious repair — cut the dose — also gives zero
heroic losses, AND returns normal 3★ to exactly its undosed value.** L21 at 2
healers prints normal `[19,19,19,19,19,19,19,19]`, byte-identical to no dose;
L25 at 4 or 3 healers takes 3★ back to 12/12, the undosed number; L30 at 4 drops
diversity to 2/8, BELOW the 3/8 of no dose at all. Each would have sat in the
data file looking like a tuned level and done nothing. **Fixing the bug-metric
is not the same as fixing the level: check the change against the dose's
PURPOSE (does 3★ still move, does diversity survive), not only against the
symptom you set out to remove.** Gold was the right lever on L21 and L25 and is
**completely inert on L30** (2050/2150/2250/2350 all still lose seed 23 and move
normal by zero), so the levers do not generalise either — measure both. Recorded
and NOT acted on: **L10 runs at median 2 with a MINIMUM of 1 across 12 seeds** —
it never loses, but it is one life from this same failure and is the thinnest
margin in the campaign, so it is the first place to look if anything shifts.
Also from the same sweep: after these fixes the campaign is clean at **36 levels
× 12 seeds, zero losses** — a far stronger statement than the contract rested on
before, when it was 36 × 3.

**PLACEMENT IS NOW VISIBLE — the branch audit's one actionable finding, shipped.
The audit measured up to 5 lives from WHICH pad a tower stands on (Sniper 15 at
one pad and 20 at another on the same level, Bertha 10 vs 13, Tail Wind 8 vs 11),
and NOTHING in the game said so: the build button offered an icon, a role and a
price, and the tower panel stated dps and range — all of which are properties of
the TOWER, none of the SOCKET.** The figure is `TDLogic.laneCoverage(levelDef,
cx, cy, range, rangeMin)` — the share of the lane, sampled every 0.05 cells, that
falls inside the annulus a tower at that pad actually covers — and it is
validated against real damage rather than assumed: Spearman ρ 0.587 / 0.798 /
0.825 on L20 / L12 / L33, with the best pad dealing 2.37× / 1.30× / 5.19× the
worst. It ships on the build button (`12% road`) and in the tower panel's stat
line, and at tier 3 each branch card states the MOVE (`road 12%→28%`). Six
things worth keeping. (1) **ASK THE ENGINE, never re-derive** — night dimming, 🦉
Night Owl, ⚡ a power pad and 🎯 Close Quarters all change reach, and a UI
computing this from `DATA` would drift exactly as the tower panel's prices did
when they showed 110 while the engine charged 99; so `engine.coverageOf(line,
tier, cx, cy, branch)` is the one owner and the guardrail asserts the rendered
string equals the engine's number. (2) **Reach is DERIVED from whichever fields
the stat block HAS**, and the first cut read only `auraRange` for the Fan — which
also carries a longer `zapRange` (2.2 vs 1.8) — so it reported a tier-1 fan
covering **0% of the lane on 312 of 451 pads**. A hand-listed field is the
recurring scope bug; taking the max over every reach field means a fifth line
inherits it. (3) **A tier-4 branch is its OWN stat block, and its reach moves in
BOTH directions** — Sniper takes the dart 3 → 5.5 while **Minigun DROPS it to
2.2**, so clamping tier 4 down to tier 3 would have asserted that a branch never
changes what it covers (false for 3 of 10) and hidden the one thing a player most
needs told: that a 300-gold purchase can quietly cover LESS road. The arrow
appears only when the figure actually moves, so the cue means something — Sticky
Bomb keeps the mortar's reach exactly and correctly shows nothing. (4) **A Camp
returns `null`, not 0%** — its soldiers block the lane rather than shooting down
it, and a percentage would assert something false about the line. (5) **Measured,
not reasoned, against the documented fold risk** — a third branch card row once
cost +111px and fell past the fold at 320×480; adding the road text costs **+11px
on the dart's 3-card row (239 → 250)** with zero overflow at 320×480, 320×568,
390×844 and landscape 844×390, and the mortar's 2-card row does not grow at all.
(6) The figure is EXPLAINED in the Toybox Guide, because ⚙️ Toy Energy already
taught that shipping a number with no name is its own defect. Seventeen
mutations, all proven: drop the figure · UI recomputes it · figure ignores the
pad · figure ignores the line · Camp shows 0% · panel drops it · show only
growth · always show the arrow · clamp tier 4 to tier 3 · drop the guide
paragraph · re-dim the figure · restore the near-white price · restore the
dimmed role · restore the renderer's own ring maths · drop the pad boost and
support from reach · restore the hard-coded ghost range · scale the dead zone
with the outer radius.
**And the RANGE RING — the other placement cue, the one on the field — was
understating reach four different ways, because the renderer did its own
arithmetic instead of asking the engine.** Measured on shipped data: the Fan's
ring was drawn from `auraRange` while its ZAP reaches further, so it was
**22% / 14% / 8% short at tiers 1-3**; ❄️ Cold Front's aura bonus was ignored; a
⚡ power pad's **+18%** never showed on the six levels that have one; and 🧊 Tail
Wind — a 300-gold branch sold on making neighbours "fire faster and **FURTHER**"
— bought a reach buff the ring could not show, so its headline benefit was
invisible on the field. A ring that understates is worse than no ring: it IS the
placement cue, and it was lying about placement. Reach now has ONE owner
(`reachInfo` → `towerReach(id)` for a built tower, `reachAt(line, tier, cx, cy,
branch)` for a pad you are still choosing, and `coverageOf` on top of both), so
the ring, the ghost preview and the % road figure can never disagree — and the
build ghost, which shipped as a hard-coded `DATA.TOWERS.dart.tiers[0].range`,
now draws the same circle on a power pad as the engine actually grants.
**The test lesson repeated itself inside this very fix:** my first ghost-ring
guardrail called `setSelection` with its own computed value, which proves the
renderer draws what it is handed and would notice NOTHING when td-main stopped
handing it the right number — reverting the hard-coded literal left it green. It
drives a real pad TAP now, and then it fails. Same shape as the `pushFx` lesson
one level up: a test that constructs the input cannot see the producer break.
**And UNIFYING two code paths is itself a place to introduce a disagreement:**
folding the ring and the coverage figure into one `reachInfo` made it natural to
apply the pad boost and the support multiplier to BOTH radii, and the engine
applies them to neither minimum — its mortar call passes `rangeMin *
mortarMinMul` raw and wraps only the max in `reachOf()`. So the refactor briefly
grew the dead zone under a mortar standing on a ⚡ power pad, i.e. the surface
whose entire purpose is agreeing with the engine disagreed with it. Its
guardrail had to SEARCH for a pad where the two answers differ — on L3's socket
both come out at 12.921% and the clause would have been vacuous; L22's p7 reads
12.33% against 11.24%. **When you merge two callers into one helper, check every
argument each caller was NOT transforming, and prove the new test on data that
can tell the two behaviours apart.**

**And measuring the new label's CONTRAST found two shipped AA failures on the
same button — the fort's own contrast pass reported 0 across 10 surfaces and
had never opened the build menu.** The road figure was first styled `opacity:
0.62`, which measured **2.66:1**; the diagnosis is one number and it decides the
whole surface. The affordable state paints `#052a14` on `#2fa562` = **4.96:1 at
full strength** — over AA's 4.5, with nothing to spend — while the other two
states have plenty (yellow 9.92, maroon 7.25). So on this button `opacity` is
never an available dimming tool, and the shipped `.td-buy__role` at 0.78 was
already at **3.52:1** while `.td-buy__cost`, the biggest text and the word the
player is deciding with, was a near-white `#eaffef` at **3.00:1**. All three now
sit at 4.96-9.92 and hierarchy comes from SIZE and CASE instead. Two method
notes: **read the real CASCADE, not a list of CSS rules** — the guardrail drives
both affordability states in a browser and audits every text run inside the
button, so a label added tomorrow is audited without anyone remembering; and
**a byte-count check cannot see a same-length mutation** — `#052a14` → `#eaffef`
is the identical length, so my own `len(s2) != len(s)` assert fired and skipped
the mutation entirely, which looked exactly like the guardrail passing. Compare
the STRINGS. That is the em-dash mutation trap wearing a different hat, and it
is now the second time it has bitten in this repo.

**THE BRANCH AUDIT'S TWO RECORDED GAPS ARE CLOSED, AND BOTH ANSWERS ARGUE
AGAINST EVER RE-TUNING A BRANCH STAT.** (1) **On heroic, a branch's sign is a
property of the LEVEL, not of the branch.** Swept over the seven late finales
(4 seeds, convert 1, the shipped best-of-two plans): **Sniper Scope reads +12 on
L16, −7 on L20, −2 on L24 and ~0 on L28/L32** — the same 300-gold purchase is
the best and the worst pick in the game depending on which map it stands on.
Two more results worth keeping: **Static Zap on L36 is +6 with ZERO variance
across all four seeds** (14,14,14,14 against a control of 8), the cleanest
single branch result measured anywhere; and **L12 is inert — every arm returns
the control's exact numbers with `bought=4`**, because that level is decided
long before a board is full and maxed. Combined with the recorded normal-side
finding (every branch positive at its BEST pad, up to 5 lives of swing from
placement alone), this settles the design question: **no set of stat numbers can
make a branch right in both places, so the answer was always information** —
which is what the `% road` figure and the overkill warning ship. Do not re-tune
a branch's damage to "fix" a level. (2) **The camp branches measure ~zero, and
now on more than one level.** With a camp-inclusive plan (`PLANS=camp`, so the
control runs the same board), **11 of 14 level-difficulty combos are
byte-identical to control with `bought=4` proving the purchases landed**. Dino Squad moves **+1 life on L28
normal** (3→4, 8→9, 6→7 on three seeds) and flips a single L16 heroic seed from
a loss to a 1-life win. In the three combos that DID move, the two branches are
**identical to each other** — on L36 heroic both read exactly `[3,7,3,5]`
against a control of `[2,7,2,7]` — which is the signature of a PRICE effect
rather than an ability effect: converting anything costs 300 gold, and the
`--priority` arm already records that a control which costs something is not a
control. So the two camp ultimates are, on the finales,
effectively decorative. **Two limits stated rather than glossed:** the CAMP plan
is deliberately WEAKER than either oracle plan (it loses seeds on L16/L28
heroic), so only the controlled comparison means anything, not the absolute
lives; and this converts the FIRST eligible camp, with the pad NOT swept —
given that placement is worth up to 5 lives on the shooting lines, a
`BRANCHPAD` sweep could still move it, and that is the honest next probe rather
than a conclusion already drawn.

**THE FORT'S CONTRAST PASS WAS SCOPED BY A HAND-WRITTEN SURFACE LIST, AND
WIDENING IT FOUND THE SAME LAW BROKEN TWICE MORE — but the finding that matters
is the one about my own guardrail, which shipped blind to every NUMBER in the
game.** The recorded pass reported "0 WCAG AA failures across 10 surfaces" and
had never opened the build menu, where measuring then found two (role 3.52:1,
price 3.00:1). Deriving the surface list instead — every dialog the fort home's
own `.td-metabtn`/`.td-adminrow` buttons can open, plus the play screen's real
states — audits 14 surfaces and found **4 more ACTIVE runs below AA, all on
surfaces the old list never opened**: `.td-branch__role` dimmed to **4.40:1**
(the text stating what a 300-gold ultimate does, and where the new road delta
lives) and `.td-target` at **4.45:1**. Both are the identical law the build menu
taught — the affordable fill paints `#052a14` on `#2fa562` = **4.96:1 at full
strength**, so there is no headroom to dim on — which means **my own fix a day
earlier was scoped to `.td-buy__*` when the law is about the FILL**. Fixed to
4.96:1 by removing the opacity and matching the ink; hierarchy is size and case.
Five things worth keeping. (1) **A wider replacement must be proven against the
mutations its predecessor caught.** The new audit caught 3 of the 4 CSS
mutations and silently missed `.td-buy__cost` — because the "is this run ART?"
test was an emoji character class, and **`\p{Emoji_Component}` MATCHES THE ASCII
DIGITS** (they are keycap bases), so `"70🪙"` tested as emoji-only and the audit
skipped **every number in the fort**: prices, gold, lives, wave counts, star
costs. The rule is now "no letter and no digit ⇒ ART" (`!/[\p{L}\p{Nd}]/u`). A
replacement test that is wider in principle can be narrower in fact.
(2) **Calibration is baked in, because two surfaces silently never opened** — a
surface that fails to open audits the runs of the screen behind it and reports a
clean sweep, so each surface asserts a minimum run count and each home dialog
must ADD runs over the bare home. The pause menu did exactly this (37 runs,
identical to the tower panel behind it) for the same reason worth remembering:
**`__TD.newGame` leaves the run PAUSED, so the first ⏸ tap RESUMES instead of
opening the menu.** Its mutation proof is a `showPauseMenu` that returns early —
the audit must go RED, not quietly pass. (3) **WCAG 1.4.3 exempts INACTIVE
components, and 14 of the 18 findings are exactly that** — locked star-tree
nodes, locked endless arenas, the disabled equip `＋`, the unearned difficulty
pips — where dimming IS the signal; they are classified by measurement
(`[disabled]`, `aria-disabled`, a `--locked`/`__dim` ancestor) rather than
argued, and the exempt COUNT is asserted so the exemption cannot silently grow
to swallow the audit. (4) **Composited computed styles beat screenshot decoding
here**: the fort body is a dark navy gradient, and for light ink the WORST case
is its LIGHTEST stop, so bounding by `#1b2c4d` is rigorous and needs no PNG
decode — which takes the pass from the recorded 77s (explicitly kept out of CI)
to **9s**, and that is the whole reason it can be a guardrail instead of a
memory. (5) A run is deduped by class+text and skipped when `elementFromPoint`
says something else is on top, the two sampling rules the 华丽 pass already
needed.

**THE MINI-BOSS WAS COMMISSIONED AS A FULL CONTENT PHASE AND THE PHASE'S OUTPUT
IS A LAW ABOUT THE ENGINE, NOT A BODY.** Two attempts were already on the record
as refuted; rather than trust that, the phase rebuilt the instrument
(`tools/td-miniboss.js`, shipped oracle verbatim, ADDITIVE dose) and reproduced
the recorded null exactly — L26 base `20×8`, a 2400hp toll elite `17×8`, spread
0 — before measuring anything new. **Six shapes, all constants**: additive toll
body (`17×8`), split into three plain elites (all die, `20×8`), a single heal
elite (`19×8` flat from 2400 to 3600), a spawn kit (`18×8`), a hurry aura (`18`
with spread 2 at exactly one hp, but 3★ unmoved at 8/8), and — the decisive one
— three mid-weight healers, which give **byte-identical results at 400, 600 AND
800 hp on two levels**. The hp is not a knob; it saturates. One refinement to
the old record, found by sweeping INTO the cliff as the L8 lesson says to: a
graded band **does** exist and is useless — `2100 → 20×8`, `2200 → spread 3,
3★ 1/8`, `2300 → 17×8`, i.e. ~100hp of ~2200 (4.5%), weighted 7:1, with the
reward already gone inside it.
**THE LAW: in this engine a SINGLE body is deterministic, so it can only ever
charge a FIXED TOLL — variance comes from MANY MARGINAL AGENTS, not from one big
one.** The board's damage and the body's transit are both deterministic, so an
elite either dies before the exit or does not; every kit merely selects *which*
constant it lands on. That explains rather than restates why the one lever that
works, works: the shipped healer doses are 3-5 *small* (85hp) healers in the
crowd, and they grade with spread 4-5 because many small agents die at different
times under seed jitter and compound differently. It also explains the shipped
bosses: each is hand-tuned to sit inside its own ~3%-wide band, which is an
authoring act for nine finales, not a reusable pattern. Corollary for the next
author: **"the median moved" is exactly what a disguised constant does** — judge
a dose on spread and on the star outcome, never on the median alone.
**The phase then proposed a FINALE as the one remaining honest lever, and
measuring that closed the axis from two MORE directions.** (a) **A boss on a flat
level is STRUCTURALLY FORBIDDEN** — `TD structure` asserts `bossLevels ===
worlds.map((w,i)=>(i+1)*4)` ("a boss headlines each world finale"), and that
contract is load-bearing for the unlock ladder, the endless gate and the star
ceiling. The proposal was made without checking it was available, which is its
own lesson: **check that a lever is structurally reachable before offering it**.
A tenth world is the only legal home for a new finale (and would leave the
ceiling at 120⭐ against the 123⭐ tree, margin 3). (b) **A near-constant finale
cannot be de-quantized by boss hp.** Five of nine finales are near-constants
(L4 spread 1; L12/L20/L24/L32 spread 2) — the same defect as a flat level. The
Bed Monster sweeps `1200-1680 → 20,19,…` (always dies) and `1700-3400 →
14,13,…` (always leaks), byte-identical across 2400-3400, so the shipped 2400 is
nowhere near a band; the whole transition is **1680→1700, a 20hp window 1.2%
wide, and every seed flips together**. (c) **So the law extends from elites to
BOSSES.** L24 does vary by seed (12..14) — but the Moving Van leaks on every
seed at every hp from 3000 to 5400, so all of that variance is pre-boss chip
damage from the CROWD. L8 was de-quantizable only because its level carries
enough pre-boss variance for the boss's fate to land differently across seeds:
that is a property of the LEVEL, never a knob on the boss. The difficulty axis
is therefore closed from three independent directions — non-boss elites are
constants, a boss on a flat level is forbidden, and a finale cannot be graded by
hp — and in every case the reason is the same single law.
And the flat set has nothing left to dose regardless: the derived scan
(`SPREAD=1 node tools/td-threat.js`) names 13 levels that ask no question, 5
carry levers, and every remaining one already has a measured reason on the
record (L1/L2 tutorial by design, L5 pinned by `AUDIT mono builds`, L14 buys 0/8
diversity, L17 two heroic losses and a no-op, L22 no safe dose in the whole
grid, L26 every 4-seed candidate failed at 8, L30 shipped for diversity). The
honest lever if a level must bite is a FINALE, because a boss is additive,
budget-exempt and hand-tuned into its band — the thing the engine already
supports.

**And the same pass found a THIRD defect on an axis nobody had measured: two of
her games showed 15.2px INSTRUCTION text.** Her world is the only one here whose
user reads — Josh is a non-reader by design and the fort is Jon's — and the nav
pass had already raised her home and category titles off 12.8/15.2px for that
reason, but her GAME screens had never been measured. Across all 40 the floor was
15.2px on exactly two: 找不同's `▲ 上图 · 下图哪里不同？ ▼`, which IS the
instruction, and 古筝's sound hint. The other 38 already held 16px+, so the fix is
a ratchet on shipped behaviour rather than an invented threshold, and `.music__hint`
is shared with Josh's music pad (where 15.2px is right, because that line is for
the grown-up) so the size fix is scoped to `.game--hl`. **The lesson is that BOTH
runs had already been through the painted-CONTRAST pass** — which fixed
`.music__hint` at 2.02:1 and `.hl-diffvs` at 4.40:1. That pass measured COLOUR;
nothing had ever measured TYPE. Two audits over the identical runs, each blind to
the other's axis. So when a pass finds a defect on a surface, ask which OTHER
property of that same surface nobody has measured — a guardrail now walks every
one of her games and fails on any letter/digit run under 16px.

**THE SAME BESPOKE-SEED CLASS APPEARED TWICE MORE, AND THE SECOND ONE WAS
GUARDING THE MECHANISM MOST KNOWN FOR CLIFFS.** Sweeping the suite for the L32
shape found the healer-dose lock sampling `SEEDS = [1, 3, 5, 7]` — bespoke, on the
one mechanism this file records as hiding SINGLE-SEED CLIFFS, and those cliffs
were on seeds **23 and 2, neither of which that set contains**. Switching to the
standard set made it fail on L19, which looked like a defective dose and was not:
measured against its own no-healer control, **L19's dose takes a dart swarm from
~18 lives to ~10** — exactly the "roughly halves what a dart-only board keeps"
this file already claims these doses are for — while leaving best-of-plans flat,
because the mixed plan absorbs it. The test was asserting the wrong quantity.
**Measured, the six doses work through TWO channels**, which is why no single bar
could see them all (worth vs control, standard seeds): L19 gap +8 / lives 0 · L25
gap +6 / lives 0 (punish the dart swarm) · L33 gap 0 / lives +4 · L34 gap +1 /
lives +3 · L21 gap 0 / lives +1 (cost lives outright) · **L30 gap −1 / lives 0**
(worth nothing, which this file already recorded — and the control shows its
stated diversity fallback does not hold either). So the assertion is now a
DISJUNCTION against a per-level control: cost best-of-plans lives OR widen the
dart-vs-mixed gap. Two things that improves. The old `lives.some(x < 20)` check
was **passing on seed luck** — L19 is flat 20 on every standard seed and survived
only because seed 3 was in the bespoke set — and the diversity clause beside it is
a COUNT that reads 12/12 with the dose AND 12/12 without, so it could not detect
removal at all; only the hard-coded id list protected them. And the test's own
mutation note said killing the healer "does NOT isolate this assertion" because
the 20/20 check threw first; with the control it now fails directly (`L19 … worth
0 against its own no-healer control`), so a PRODUCT mutation isolates a product
claim. **A recorded number was also wrong**: L19's normal column here read
`20,16,20,20,20,20,20,17` and both the shipped tool and the test harness give
`20 ×8` on those seeds — the 16/17 land on seeds 3 and 19. A balance number in
this file is evidence, not proof.

**A BESPOKE SEED SET INSIDE ONE AUDIT HID A THIRD ERASED FINALE — and the reason
more seeds is NOT the fix is the part worth keeping.** `AUDIT boss tension with
the strongest LEGAL loadout` asserts no finale is erased by the strongest legal
6-node pack, exempting L8 and L16 as boss-QUANTIZED. It drove `SEEDS = [1,2,3,4]`,
its own set, where the rest of the suite standardises on `{1,7,13,23}`. That is
the "a scan's own list is part of the scan" class applied to SAMPLING, and it was
hiding a real erasure: measured over 12 seeds, **L32's lives-lost vector against
that pack is `[0,6,7,6,0,0,7,0,0,0,0,0]` — erased on 8 of 12** — while `[1,2,3,4]`
is the unrepresentative quarter and reported a median of 6. **The seductive fix,
"use more seeds", does not work**: a quantized finale's outcome is BIMODAL, so the
median is unstable in the sample size — 4 seeds say 6, 8 seeds say 6, 12 seeds say
0. Switching to the set the suite already uses costs nothing, reads the truth
(`[0,0,0,0]`), and was verified against all ten finales first: no other level
drops below the floor and several read HIGHER. So L32 joins L8 and L16 as the
THIRD quantized finale — its no-meta cost is a healthy 7 lives, but the Big
Magnet's 6-life toll means one boss leak IS the level, so any damage increase
flips it from one leak to none. **Stated plainly: this extends a BASELINE the
test's own message says not to extend.** The justification is that it is the same
measured shape as the two already there, that the pin is at the measured value so
it can still fail if L32 gets softer, and that the audit now holds SEVEN finales
to the real bar rather than the 4-of-6 it had when that message was written. The
alternative — re-tuning L32 so its finale survives a maxed pack — is recorded as
an option and not taken, because the L8 sweep showed a quantized finale has only a
~200hp-wide band where it grades at all. Also measured and REJECTED on the way:
a cost-ordered worst-legal pack (the obvious self-updating fix for "any node
appended to the fire branch is never erosion-tested") is WEAKER than the shipped
one on 6 of 10 finales, so swapping it would have lost coverage — cost is a poorer
proxy for power than it looks.

**The post-World-10 deep pass: the boss's headline mechanic was UNDRIVEN, the
determinism suite cannot see a historical drift, and the world itself came back
CLEAN on 16 seeds.** Taking the last one first, because a negative result is the
cheap half of an audit and this one closes a real worry: L40's escort is 5 Junk
Healers, the exact shape recorded as hiding single-seed cliffs (L21, L25 and L30
each concealed one from an 8-seed sample), so the world was re-swept on 16 seeds
— **all 64 level×seed heroic combos win**, no cliff, and L40's normal spread
actually WIDENS from 6 to 8 (4..12). The plausible reason the mechanism did not
bite is structural and worth keeping: these healers ride a BOSS wave, which is
budget-exempt and met with a fully built board, rather than a mid-game dose
landing on a board still under construction. L38's heroic minimum of 4 is the
number to watch — thin, but above shipped norms (L29 floors at 2, L10 at 1), so
it is recorded rather than tuned away. The other two findings are about
coverage rather than behaviour. (1) **`AUDIT boss kits` had no `hurry` branch.**
It is derived and drives stomp / suck / enrage / spawner plus every per-band
phase key — but `hurry` is a TOP-LEVEL field, so the per-band loop cannot see it
either, and 🎁 The Big Present's entire design justification (it never hits you;
it makes the party ARRIVE FASTER) was declared with nothing driving it. The kit
could have shipped dead and the audit would still have gone green on its phases.
Measured first: the feature is CORRECT — an escort beside the boss covers 1.347×
the ground against a declared 1.35, and it composes with a Boom Box exactly as
the one-owner `applyHurry` law requires. So it was a pure coverage hole; the
branch is derived (a future aura boss inherits it) and measures GROUND COVERED
rather than a flag, because hurry never sets a field on the body it speeds up —
the same trap the `enrage` branch beside it documents. (2) **Every determinism
assertion in the suite is `hashState(a) === hashState(b)` — self-consistency, not
a pinned historical hash** — so if adding World 10's three skins had perturbed an
existing level's spawn stream, nothing would have caught it. Measured against a
worktree at the pre-World-10 commit with a fixed script on all 36 older levels:
**every hash identical**, so the world is a true default-noop and the `sortKey`
mechanism held. No literal-hash pin was added (36 literals would have to be
re-typed on every deliberate balance edit — a fence, not a law); what was added
is the missing half of the skin law: `P2 skins` checked that a NON-skin has no
sortKey and never that a SKIN's equals its ancestor, so a skin with a wrong key
would sail through while a different skin's behavioural check passed. Now derived
over every skin, mutation-proven.

**华丽's ART pass found the SAME defect twice, and both times the guardrail that
exists to catch it was scoped to Josh's registry.** Her home showed 🏮 on BOTH
贴纸 and 民俗文化 — two identical red lanterns side by side, on the one screen a
70-year-old navigates by picture — and the tile-icon law that caught 45 of Josh's
240 tiles could not see it, because a home's category / 随便玩 / sticker-book
tiles are built directly by main.js and hl-main.js and are NOT registered games.
It walks the rendered nav tiles of both homes now, per screen. Her 🏮 book was
the second: Josh's was fixed to 200/200 unique prizes and hers still picked one
of 25 motifs by hash, measuring **22 unique across 40 games with 28 of 40 sharing
one** — and its guardrail is literally titled "Josh's 200 games". Same fix as
his (the motif ON a shaped, coloured seal: 25 x 4 x 8 = 800 combinations), with
his lesson applied — THREE independently-seeded streams, and the motif keeps its
ORIGINAL seed so an earned sticker keeps the picture she won. Two things worth
keeping. **FNV with a different SEED is only weakly decorrelated** — the first
cut measured 36/40, which is the "one hash sliced into bit-fields" trap wearing a
different hat; a murmur3 finalizer on the derived streams gives 40/40, while 5
shapes measures 38/40, so this is a property of these hashes and these ids rather
than a monotonic one. And **a probe that RETYPES a hash measures its own typo**:
my first reading of the book said 19 unique / 33 sharing, computed with an h*31
hash against a shipped FNV, and it was the mutation message DISAGREEING with it
that exposed the error. Copy the hash out of the source.

**WORLD 10 — 🎉 The Party (L37-L40) SHIPPED, and it is the one lever the closed
difficulty axis left open, acted on.** The mini-boss phase ended with exactly one
route: a finale is additive and budget-exempt, and `TD structure` allows a boss
only on a world's fourth level, so a new finale means a new WORLD. That was
blocked on the star ceiling (`LEVELS.length * 3`), so the tree was grown FIRST by
BREADTH — five new KINDS, never ranks — to 140⭐ against the 120⭐ that 40 levels
create (margin 20). The world itself is the only one where the displacement chain
runs the OTHER way (the toy World 9 melted down is wrapped and GIVEN), which is
why it is the brightest floor in the game rather than a tenth dim room: its own
`confetti` pattern and `chain` road, three skins (🎊 Party Popper / 🍬 Loose
Sweet / 🎏 Stray Streamer), a tenth arena, and the fork+lever on L38.
**🎁 The Big Present is the first boss whose kit is a `hurry` aura** — it never
touches you, it makes the whole party ARRIVE FASTER, which is a threat damage
cannot answer and which needed no engine code at all (the Boom Box's write pass,
read in the ONE `effSpeed`). Nine bosses ship stomp/suck/enrage/disable/spawn in
various mixes and none had ever carried it. It measures as a real finale: normal
`6,12,12,6,12,11,12,12` (median 12, **spread 6**) and heroic median 8, no losses
on 8 seeds — graded, not a fixed toll, which is precisely what the mini-boss
phase proved a non-boss body can never be.
**THE MEASUREMENT WORTH KEEPING is L38's, because it names a quantity this file
had only ever gestured at.** Its first cut ran a **36-cell** default lane — the
shortest in the campaign — and measured normal med 10 with **heroic LOST on every
seed**. Gold is completely inert against that: 1300 / 1600 / 1900 / 2200 / 2500
all lose every heroic seed and move normal by nothing. Cutting the wave budget
does not fix it either — at `base 700` normal finishes `20,20,20,17`, comfortable,
while heroic still loses all four. The quantity that actually decides it is
**total EXPOSURE = Σ(pad lane-coverage) × lane length**, i.e. how many cell-passes
of tower fire the whole board delivers: L38 measured **39** against L31's 53 and
L40's 66, so the board was 40% short of a normal one and no amount of money could
buy the missing seconds. Re-searched to a 44/72 fork (exposure 43.7) and re-tuned
to `base 800, count 13, gold 1700`, it lands at normal median 18 (graded, 16-20)
and heroic median 9 with no losses. **When a level is unwinnable on heroic while
normal looks fine, measure exposure before touching gold or the budget base** —
and note this is the TD-4 "a short path is HARDER" law finally expressed as a
number you can compare across levels, which `TDLogic.laneCoverage` (shipped for
the placement UI) makes a one-liner.
Two smaller notes. The **fork's value must be measured, not assumed**: L38's
lever is decisive at an 8-pad board (short 0/4 → long 3/4) and worth 6 lives at
9, which is what `TD7 lever advantage` now pins. And L37 ships at a flat `20 ×8`
on normal — the **seventh** reproduction of the step function, recorded rather
than faked, exactly as World 5 and World 9's openers were.
**The visual vet of the new floor found one real defect, and it is about a
SHARED primitive meeting a NEW context.** World 10 is the first BRIGHT floor in
the game, and its prop trio included `stain` — a floor MARK, drawn as a dark
ellipse at ≤0.62 alpha with no cast shadow, because it is a mark rather than a
form above the ground. That is subtle on the four DARK floors that use it
(attic / garage / sort line / toy works) and on a plum carpet it reads as a
HOLE: three of them in one screenshot quadrant, indistinguishable from the
duplicate-shadow defect the owner once reported as *"some of the shadows are
just circles after circles"*. Swapped for `tin`, which has form and a shadow.
The rule: **a floor-MARK prop belongs on a dark floor; a light floor wants props
with FORM** — and the only way to know was to look, because no number test can
tell a hole from a shadow from a mark. The same pass confirmed the two things
that class usually breaks: 🎉 fits inside the road at the lane start (the
bed-glyph ink-fit law) and the exit is the striped hazard threshold, so the two
ends of the lane are never confusable.

**And the world broke a guardrail by GROWING, which is the more transferable
find: a CALIBRATION that uses a proxy instead of the claim goes stale with the
thing it measured against.** The fort contrast audit proves each dialog really
opened — the two surfaces that once silently audited the screen behind them are
why it exists — and it did that by asserting the dialog's TOTAL visible text
runs exceeded the bare fort home's. That is a proxy. `💾 Backup` and `⚙️ Reset
fort` sit at the BOTTOM of the home, so Playwright's click scrolls the page to
1094px, the home's own visible runs drop out of the viewport, and the total fell
BELOW a bar derived from the unscrolled home — a false failure on two dialogs
that had plainly opened (measured: 5 and 8 runs inside `.td-overlay`). It had
been passing on luck, and World 10's four extra level cards took the home from
53 to 61 runs and ended it. The fix measures the CLAIM: count the runs that came
from inside the overlay itself, which cannot drift with the home's height or the
scroll position — and it is the same shape the audit's other seven surfaces
already used (prove it opened by its own element). Mutation-proven by skipping
one dialog's click: *"dialog 🏅 Badges: 0 text runs inside .td-overlay"*. The
general rule, now paid for once more: **when a check asserts "X happened", assert
X, not a quantity that correlates with X today.**

Invariants (guardrail-locked in `site.test.js` + `tests/td.test.js`):
- **Never registers in `JoshFramework`/`JoshGames`** — no tile, no sticker slot,
  invisible to the every-game harness and the kid mobile audit. Josh's book
  stays exactly 200, 华丽's 40.
- **Storage is `jon-td-*` only** (`jon-td-save-v1`); never touches the kid star
  flags, and Josh's grown-ups reset never touches the fort. The fort has its OWN
  **⚙️ Reset fort** on the fort home (a quiet `data-adult` button behind the same
  type-the-word-`reset` gate as Josh's ⭐ reset, since Josh can reach the fort
  from the front door). It wipes progress — all three star ladders, the star
  tree, badges, endless bests and any saved run — and KEEPS preferences (sound /
  music / damage numbers and the difficulty chip), mirroring Josh's reset
  preserving the mute toggle. **`resetProgress()`/`freshSave()` in `td-main.js`
  is the ONE owner**: the button and the `__TD.resetSave()` test hook both go
  through it (a new persisted field can't be covered by one path and missed by
  the other), and it passes `{force:true}` so the two-tab monotonic merge can't
  fold the wiped stars/badges straight back in.
- **Audio only via `JoshAudio.tone`** (the ONE iOS-safe path) + the global 🔇.
- **The engine is deterministic**: 30Hz fixed timestep, seeded RNG only (the
  `Math.random`-free rule is guardrail-scanned), plain-JSON state. That's the
  test strategy: node sims play whole levels headless (winnable by the scripted
  build, losable by neglect, wave tables audited against the budget curve), and
  the shipped `window.__TD` hooks (newGame/script/untilPhase/winL1) are the
  browser-test contract — the real-time analog of `data-correct`.
- Every known `td-*` hash opens **directly** (no gate); an unknown one falls
  back to the front door. `main.js` still wraps the fort in try/catch so a
  fort failure can never break Josh's site.

> **Friend & character art (`scripts/art.js`).** `JoshArt.friend({skin,hair,style,shirt})`
> draws each kid as a clearly-different portrait (Josh, Raegar, River, Viraj — see
> their heritage-informed specs in `content.js` `FRIENDS`). Faces show up in **Spell
> My Name**, race in **Friends Race**, headline the **turn banner of every co-op
> game** (`coopTurn()` in `games-calm.js` — "Josh's turn!" shows Josh's face), and
> beam from the **I Did It! certificate**. The other art is now used widely too:
> `numberFriend()` (Numberblocks-style) is the countable in **Add It Up** &
> **Find the Number**; `hero()` fills **Find the Heroes** (a colour search) and pops
> on every win; `pup()` (with per-pup collar colours in `PUPS`) fills **Paw Patrol
> Rescue**; `balloon()` is **Pump the Balloon**; and **Peekaboo** hides friends,
> heroes and animals. Keep the four friends visibly distinct and pup collars unique
> (`content.test.js` guardrails enforce both).

Games personalize by rotating Josh's friends (**Raegar / River / Viraj**), Spidey
heroes, and Paw-Patrol/Rubble homage names (**emoji + names only — not the
copyrighted artwork**). Every win celebrates (confetti + spoken praise) and every
wrong tap is a gentle bump with the target left in play (no score loss, no "you
lose"). The launcher has a **🎲 Surprise!** tile and a **⭐ badge** on every game
Josh has beaten (`josh-won-<id>` in `localStorage`, owned by `JoshProgress`). A
**📖 Sticker Book** tile opens a scrapbook with one slot per game: beating a game
"plops" its deterministic signature sticker (`JoshStickers.artFor`, drawn from
`JoshArt`) into place, and a star meter shows how full the book is — a filled slot
replays its game. When sound is on, every win rings a rising **jingle** (correct
rounds a soft confirming tone, wrong taps a gentle non-punishing bump) via the
centralized, mute-gated `JoshAudio` cues, so every game inherits sound feedback.
Josh picks a **buddy** once (a companion on the home screen); that single choice
(`JoshBuddy`, `josh-buddy`) then stars in **every win celebration** — the pop is
his chosen character, not a random hero. The buddy roster is built from the
existing `HEROES`/`FRIENDS`/`PUPS` + `JoshArt`, so adding a friend/pup there
offers a new buddy automatically.

> **Correctness is a hard requirement** (teaching tool): `tests/content.test.js`
> restates the ground truth (first sounds, rhymes-by-phonetic-key, CVC structure,
> sight words, digraph prefixes, and exact truth tables for every sort) and fails
> if any answer would become wrong. Update the truth there when you change a fact.

**Installable PWA** — `manifest.webmanifest` + `sw.js` make it add-to-home-screen
installable with a friendly star icon, and it **works offline** (great for car
rides). The service worker is network-first: fresh when online, cached offline.

### Adding a game (the framework + test contract)
Register a game into one of the `scripts/games-*.js` files (or a new one wired
into `index.html`, `sw.js`, and `tests/site.test.js`'s `SCRIPTS` list):

```js
window.JoshFramework.register({
  id: "my-game", icon: "🎯", title: "My Game", skill: "… [W]",
  start(api) {
    api.setPrompt("Tap the right one!", ["👀", "👉", "😊"]); // spoken + icon strip
    // Build UI into api.stage. Put pure logic in scripts/logic.js and unit-test it.
    // TEST CONTRACT (so the generic harness plays it automatically):
    //  • mark the correct next tap(s) with data-correct="1"; remove once consumed
    //  • call api.win() when finished (sets screen.dataset.won); api.roundWin() per round
    //  • api.tryAgain(el) for a gentle no-fail wrong tap
    //  • pure toys (no win): mark [data-toy] and call api.tickPlay() each interaction
  },
});
```

The `api` gives you: `el`, `stage`, `setPrompt/speak/say`, `win/roundWin/tryAgain`,
`shouldRamp(n)`/`streak()` (invisible difficulty adaptivity — true once Josh has
won `n` rounds in a row with no miss; resets when he stumbles; a game reads it to
pick a harder/easier round, never showing a number or a fail),
`friend()`/`hero()` (rotation), `shuffle/randItem/randInt/pickIndex`, `tickPlay`,
`mascot()` (opt-in reactive buddy — call it after building a round; it cheers on
`win`/`roundWin` and wiggles on `tryAgain`, and fills the empty space in flat
quizzes). The stage auto-centres the play and adds a floor, so a new game never
strands its content in the top third.
Adding a game this way is **automatically** exercised by `e2e.test.js` (played to
a win) and audited by `mobile.test.js` (≥75px, no overflow) — plus add unit tests
for any new `logic.js` function and a browser check if it needs special handling.

### Test/preview hooks
- `JOSH_BASE_URL=<url>` — run the browser tests against a live URL instead of a
  local server (used by CI's `verify-live` job).
- Sound is off by default; `localStorage["josh-muted"] = "0"` turns it on.
- Navigate straight to a game with `#<game-id>` (e.g. `#team-hop`).

> **Ideas for more games.** The old list here (ten-frame, set-the-clock, digraph
> sort, dot-to-dot, color-by-number, xylophone, peekaboo, more co-op) is now
> ENTIRELY SHIPPED — every one of them is a registered game (`ten-frame`,
> `set-clock`, `digraph`, `dot-dot`/`abc-dots`, `color-number`, `music-pad`,
> `peekaboo`, the `team-*` family). Checked 2026-07; a list that outlives its
> contents sends the next author to build what already exists. Josh is at his
> planned 200 and 华丽 at 40, so new games are a fresh design decision against
> `JOSH_PROFILE.md`, not a backlog.
>
> **What IS open (opportunities, not obligations), re-measured 2026-07 after
> World 9):**
> - **Forks/levers**: CLOSED — **each of the 10 worlds has exactly one** (L3, L7,
>   L10, L15, L19, L23, L27, L31, L35, L38), guardrail-derived from the data so a
>   world cannot ship with none or with two. `tools/td-fork-search.js` is in the
>   repo (with `RESEARCH=1`) so the sweep is repeatable. Each one's VALUE is
>   measured: L3/L10/L35 are magnitude levers (no phase flip is structurally
>   available), the other five are decisive at their thin board.
> - **Level gimmicks**: CLOSED, including the fifth. Six shapes ship (`night`,
>   conveyor, 🕳️ mud, ⛱️ blanket cover, ⚡ power pad, 🚪 side door, fork+lever)
>   across 29 of 36 levels, every world represented, each documenting itself in
>   the Toybox Guide via `TDLogic.levelGimmicks`. The FIFTH candidate — a
>   destructible obstacle — was **built and then CUT by measurement**: a crate is
>   a `fixture` soldier (so it needed no second engine read site, contrary to
>   PLAN_GIMMICKS §6.4's stated reason), but it is consumed in wave 1-2 at every
>   authorable hp including 1800, so its erode-across-the-run identity is
>   unreachable, and it changes nothing the player decides. Do not rebuild it.
> - **Level DISTINCTNESS**: CLOSED for all 40. Every world has its own backbone
>   crowd, no two levels run the same special SCHEDULE, each finale's escort asks
>   a different question, and every level has a hook or a boss — all four
>   guardrail-locked, so a new level inherits them.
> - **The meta economy**: the L8/L16 item is CLOSED. L16 had already fixed itself
>   (the earlier Tickmaster toll cut); L8 was de-quantized by Vacuum King
>   8000 → 7600 hp, taking normal from a flat 10-11 on all 8 seeds to a real
>   10..18 spread. Two things were MEASURED and are settled: the leak toll is a
>   pure offset and can never de-quantize anything (heroic came out at exactly
>   `20 − toll − 2` at every hp), and L8's heroic is structurally ungradable (the
>   King leaks at every hp down to 4800). Do not re-open either. That hp value
>   shipped with NO guardrail and is now pinned from BOTH sides by `L8 stays in
>   its GRADED band` (holdable on ≥1 seed, leaks on ≥1) — the band is only ~200 hp
>   wide, so it needs pinning, and the tempting general form of that law is
>   refuted (6 of 9 finales leak their boss on every seed).
> - **The star ceiling**: satisfied with margin. It derives as
>   `LEVELS.length * 3` = **120** at 40 levels, against a **140⭐ / 40-node**
>   tree — margin **20**. An ELEVENTH world would make it 132 and leave 8, so
>   grow the tree by BREADTH first (new kinds with real read sites), never by
>   adding ranks. The five nodes added for World 9 and the five for World 10
>   were all breadth.
> - **Difficulty**: the campaign is now measured on a floor it cannot leave.
>   `normal` and `heroic` winnability are separated by a STEP, not a slope —
>   reproduced six times, most recently on World 9's fresh maps (L33 read normal
>   12 at 900 gold, 19 at 1100, and a flat 20 at both 1300 and 1500). Several
>   levels therefore sit at a flat 20 on normal and are recorded as unreachable
>   rather than faked. The ONLY lever this engine responds to is THREAT SHAPE
>   (an hp-preserving swap); bigger HP piles, backbone stat shape, gold, budget
>   base, lane length and side-door dose are each measured NOT to work. That is a
>   deliberate content pass to commission, not a defect to fix on sight.
> - **The mini-boss**: CLOSED for the THIRD time, and ACTED ON — its one
>   remaining route (a finale is additive and budget-exempt, and a boss may only
>   headline a world's fourth level) became **World 10, 🎉 The Party (L37-L40)**,
>   whose 🎁 Big Present finishes at a median 12 with a spread of 6. The refutation
>   itself stands unchanged, with the mechanism, and
>   commissioned as a full content phase that concluded it must not be built
>   (`PLAN_MINIBOSS.md`, `tools/td-miniboss.js`). Six shapes measured on 8
>   seeds — additive toll body, split into three, heal elite, spawn kit, hurry
>   aura, and three mid-weight healers — and every one lands on a CONSTANT.
>   The decisive datum is that shape 6 gives byte-identical results at 400,
>   600 and 800 hp on two levels: the hp is not a knob, it saturates. The one
>   refinement to the old record is that a graded band DOES exist, and is
>   useless: ~100hp of ~2200 (4.5%), weighted 7:1, with 3★ already collapsed
>   from 8/8 to 1/8 inside it. Do not sweep hp again.
> - **The flat levels / threat shape**: CLOSED, and the target list is now
>   DERIVED (`SPREAD=1 node tools/td-threat.js`) rather than remembered — which
>   is what re-opened it, because the old flat-20 criterion structurally could
>   not see a level reading 19 on all eight seeds. Every level the scan
>   surfaced has an answer. The doser now enforces four rules learned here:
>   rank the confirm set on HEROIC HEADROOM (the binding axis, not the one you
>   want to move); a dose must MOVE the 3★ outcome and must not ERASE it; skip
>   levels whose difficulty is a PINNED property; and a dose must buy BUILD
>   DIVERSITY. Shipped: **L19 w12 ×4, L21 w12 ×3, L25 w12
>   ×5, L30 w13 ×5, L33 w12 ×3, L34 w10 ×3** (8 seeds each; heroic zero losses;
>   neglect still loses). Measured answers, not sampling gaps: **L22 has NO safe
>   dose anywhere in the grid**; every L26 and L35 candidate passing the 4-seed
>   screen FAILED at 8; L23/L31 are forks, where a level's difficulty IS its
>   lever's value; L1/L2 are World 1's tutorial and stay flat by design; L7 sits
>   at its measured heroic ceiling; **L5 is skipped as a PINNED level** (its
>   heroic behaviour is what `AUDIT mono builds` asserts) and all four of its
>   candidates made 3★ unreachable anyway; **L14 is a dart-favouring level** —
>   its one star-passing dose buys 0/8 build diversity for heroic 6 → 2, so it
>   pays a real cost to change nothing; **L17's** three candidates are two
>   heroic losses and a no-op that moves normal by 2 lives across all 8 seeds.
>   **L18** has a dose (w10 bucket ×3, zero heroic losses) also REJECTED — it
>   costs heroic median **11 → 5** on a level already moving on 4 of 8 seeds, so
>   it was never one of the levels that asks nothing. Do not re-try gold, budget
>   base, lane length, HP piles or side doors on any of them.
> - **🏆 Full Fort reachability**: CLOSED, measured, no change and deliberately
>   no guardrail. The oracle never 3-stars 11 of 36 levels, but L13 gets there
>   on a tier-4 BRANCH, L9/L11 on branches + Extra Hearts (0/8 → 8/8), and every
>   boss finale — including L20 at a max of 10 — 3-stars 4/4 at 24/24 on casual
>   with the full tree, which counts because stars are best-across-ladders. The
>   meta layer is load-bearing rather than decorative. A threshold guardrail
>   would have 6 lives of slack on the hardest case, i.e. could not fail.
> - **Genuinely untried**: a NEW ENEMY on an axis the roster does not have. The
>   resist matrix is full (one reduction per damage family) and the last three
>   resist shapes each measured at ~zero lives, so the next enemy has to change a
>   DECISION rather than a number — 🛢️ Oil Drum's `spill` is the template. Note
>   the two measured warnings: targeting PRIORITY is worth 0.00 lives even when
>   played perfectly and free (`PLAN_ENEMY_ESCORT` §6), and the Oil Drum itself
>   measured outcome-neutral on the shipped oracle, so "changes a decision" is a
>   design goal the sim cannot score. Build it for legibility, not for the curve.
>
> - **Tier-4 branches**: ✅ BUILT (this entry said "DESIGNED, NOT BUILT" for a
>   release AFTER all of it shipped — the "a list that outlives its contents"
>   class again, caught 2026-08 by grepping the tests instead of reading the
>   doc). Shipped: **Phase A**, one identity guardrail per branch driving the
>   declared mechanic through its own engine seam (6 in `td-logic.test.js` —
>   Sniper by first-shot DISTANCE, Minigun by the ramping damage stream, Bertha
>   by bodies caught in the FIRST shell, Sticky by a body newly slowed on a tick
>   with NO detonation, Blizzard by brittle, Static by a decaying arc; Dino's
>   `blocks: 2` and RC's `stun` were already driven and a near-duplicate is
>   noise, not coverage); **`tools/td-sim.js --branch`**, the only instrument
>   that can measure a branch at all, since both oracle plans fill with
>   `t.tier < 3` and so never call `branch()`; and the two RIGHT third
>   ultimates — 🎯 **Rust Ray** (Dart, armour strip through the ONE `computeHit`
>   armor line) and 🧊 **Tail Wind** (Fan, a support aura through `boostOf`/
>   `reachOf`, strongest-wins, never buffs itself). The panel's `a`/`b` literals
>   are gone (it derives from `Object.keys(def.branches)`), so a ninth branch
>   needs no code hunt, and a browser guardrail derived from `DATA.TOWERS`
>   drives EVERY branch through a real `draw()` on a live board.
>   **Still deliberately NOT built, with reasons:** a third ultimate for Mortar
>   or Camp (every candidate duplicates a shipped ability or gives a line air
>   access and goes red on the guardrailed two-lines-reach-air truth table —
>   *"each line has as many ultimates as it has real axes"*), and a FIFTH tower
>   LINE (~5x the cost for the same feeling, 5 sprites against a thin 0.402
>   cross-line distinctness margin, and neither oracle plan would buy it so it
>   would ship provably untested as a feature — note its old blocker IS now
>   fully cleared, since both the build menu and the panel derive).
>   **The "are the other 8 branches worth their gold?" question is CLOSED, and
>   its answer became a feature.** They are — the first sweep said otherwise only
>   because it converted the FIRST eligible tower in pad order; sweeping the pad
>   (`BRANCHPAD=n`) makes **every branch positive at its best pad on L20** and
>   shows the placement swing is up to 5 lives, larger than most branches' whole
>   headline value. Heroic then INVERTS the ranking (Sniper +12 normal, −4
>   heroic; Minigun best there), which is conclusive against re-tuning any stat
>   and conclusive FOR telling the player. Hence the shipped `% road` figure on
>   every build button, tower panel and branch card. Camp branches measured a
>   clean null on L20 with a camp-inclusive plan (`PLANS=camp`), which is one
>   level, not a generalization.
>
> - **The camp / `blockedBy` path**: CLOSED. It is the only code that can stop a
>   live enemy indefinitely and neither oracle plan builds a camp, so it was
>   nearly untested; a per-world camp sweep (derived, so a tenth world inherits
>   it) now pins its invariants, and a Dino Squad test covers `blocks: 2` — the
>   game's ONLY stat block above 1, and the sole reason the enemy loop's
>   dead-blocker rescue exists. Measured clean: 0 violations, 2172 enemies
>   blocked, ~10s.
>
> - **World 9's `mould` floor**: CLOSED, no change. Measured sixth-busiest of
>   nine floors (sd 27.5 against concrete's 52.3), wells separated at 3.2-cell
>   spacing rather than overlapping, lane clear. No busyness guardrail was added
>   — the shipped spread is 3×, so a cap would be an invented threshold.
>
> - **华丽's ART pass is DONE** (2026-08) — the item this list carried as open.
>   Two real defects, both the shape Josh's world was fixed for and hers was
>   not, and both invisible to guardrails scoped to HIS registry: her home wore
>   🏮 on BOTH 贴纸 and 民俗文化 (now 🎆, and the tile-icon law walks the
>   RENDERED nav tiles of both homes now, not just registered games), and her
>   🏮 book gave **28 of 40 games a prize another game already had** (22 unique;
>   the motif now sits on a shaped, coloured seal — 25 x 4 x 8 — for 40/40).
> - **华丽's BEHAVIOURAL pass is DONE** (2026-08): all 40 games driven, every
>   spoken line read, ~500 distinct rounds captured across her 23 pick-the-answer
>   games. Content truth came back clean; the fixes were 月亮圆缺 not naming its
>   own answer, 描福字 speaking a bare digit, and 深呼吸's raw timers. What it
>   ALSO surfaced is app-wide and is the reason to run these passes: the framework
>   celebrated on screens the player had already left.
> - **华丽's PAINTED pass is DONE** (2026-08) — this line said it was still open
>   for a release AFTER it shipped, which is the "a list that outlives its
>   contents" class for the third time in this file. Every screen captured at
>   390 AND at 834 (an iPad, which is what a 70-year-old actually holds), 11
>   findings: 两幅找不同's stretched label, the pond/找一找/charchip/row/lineup
>   pictures kept at phone size, `.hl-moonchip`'s night sky that specificity
>   never let paint, `.hl-clue` reading as the most tappable thing on a screen
>   where it must NOT be tapped, Josh's green meadow painting under her red-gold
>   screens, and 四季分明's icon strip pointing at a WRONG answer. One finding
>   was REJECTED on inspection (照样敲's "lit pad" is a 300ms bounce on a
>   disabled surface, not the documented persistent-lit-cue defect) and one was
>   already fixed.
> - **Josh's world at iPad size is DONE** (2026-08): the same axis measured
>   across his 200 found 64 of 96 picture-card games below the bar all 8 of hers
>   pass; now 3, and those 3 are the games where glyph size IS the puzzle.
>   Contrast, affordance and type are viewport-INDEPENDENT and already have
>   their own passes, so layout/size was the only tablet-specific axis and it is
>   now measured on two metrics at 0 offenders.

## Development Workflow

### FIRST, EVERY SESSION: check the clone is not stale — AND that you are on `main`
This runner restores the writable disk from a pinned SNAPSHOT, so a session can
start with the repo rolled back to an old commit while `git status` reads
perfectly clean. It happened five times in one session, once mid-edit — and that
is the dangerous case, because uncommitted work then sits on a stale base and
committing it REVERTS everything since. It can also come back on a DIFFERENT
BRANCH, which is the same silence in another costume: RULE 1 ships to `main` and
the deploy only runs there, so a commit made on a side branch is finished work
that never reaches Josh. Do this before touching anything:

```bash
git fetch origin main -q && git rev-parse --abbrev-ref HEAD && git log --oneline -1 && git rev-parse --short origin/main
```

If HEAD is behind `origin/main`: with a clean tree, `git reset --hard
origin/main`. With uncommitted work, save it first — `git diff > /tmp/save.patch`,
reset, then `git apply -3 /tmp/save.patch`.

**And VERIFY the push landed — the message is not the evidence.** `git push -u
origin main` pushes the local ref named `main`; if HEAD is on another branch
that ref has not moved, so git prints a perfectly truthful **"Everything
up-to-date"** and nothing has shipped. Worse, `if git push ... | tail -3; then
echo PUSH OK; fi` tests the exit status of `tail`, which is 0 whatever the push
did — so a failed push reads as a success. This nearly ended a session
reporting a shipped fix while the live site stayed two commits stale. Check the
REMOTE, not the wording:

```bash
git push origin HEAD:main && [ "$(git ls-remote origin main | cut -c1-8)" = "$(git rev-parse --short=8 HEAD)" ] && echo "remote head matches HEAD"
```

**This cannot be automated from inside the repo.** A `.claude/` hook lives in the
very tree that rolls back (and an uncommitted one is simply deleted), and
`/root/.claude/*` is regenerated by the environment at every boot — both were
tried and neither survives. Detection has to be a habit, not a script; the one
thing that always works is that `git fetch` reaches the real remote.

### Verifying locally
It's a static site — serve the folder and open it:

```bash
python3 -m http.server 8000   # then open http://localhost:8000
# or: npx serve .
```

Manually confirm the changed behavior and check a narrow/mobile width. For
interactive changes this manual pass is in addition to — never instead of — the
automated browser tests (see Testing, RULE 2, RULE 6).

### Testing
```bash
npm install     # first time: installs Playwright (dev dependency)
npm test        # node --test over tests/*.test.js (unit + e2e + mobile)
```
- `tests/site.test.js` — fast, browser-free structure/content/logic checks.
- `tests/e2e.test.js` — Chromium; taps the toys and asserts the result; ends by
  asserting there were **no uncaught page errors**.
- `tests/mobile.test.js` — **real WebKit (Safari engine)** when installed, else
  Chromium iPhone-emulation; validates touch, no horizontal overflow at 390px
  and 320px, and that every tappable element is ≥ 75px.

All must pass before every push (RULE 2 & 3).

**Browser binaries:** tests auto-locate one — Playwright's expected browser if
present, else a scan of `$PLAYWRIGHT_BROWSERS_PATH` (`/opt/pw-browsers`). In this
dev sandbox Chromium is preinstalled (WebKit is not), so do NOT run
`playwright install` here — mobile tests fall back to Chromium locally. CI runs
`npx playwright install --with-deps chromium webkit`, so real Safari-engine
coverage happens there. Note: continuously-animated elements need `{ force: true }`
clicks, and you should poll-and-tap **inside** the page rather than reading a
moving target across the test/browser boundary.

**Testing the live site:** set `JOSH_BASE_URL=<url>` and the browser tests run
against that URL instead of a local server (used by CI's `verify-live` job).

### Deploying (automated)
`.github/workflows/deploy.yml` runs on every push to `main`:
1. **test** job — `npm test` (unit + e2e + mobile WebKit) must pass.
2. **deploy** job — `needs: test`; rewrites `__BUILD__` → `<sha>` to cache-bust
   assets, then uploads the repo root and publishes to Pages.
3. **verify-live** job — `needs: deploy`; waits for the live URL to serve this
   commit, then runs the browser suite against the **live** site (Chromium +
   WebKit). This is the real proof the deploy works.

A failing **test** blocks the deploy; a failing **verify-live** means the live
site is broken — fix forward immediately. After pushing, confirm all three jobs
are green.

> **One-time GitHub setup** (do these once, they block deploys until done):
> - Repo must be **public** (done).
> - **Settings → Pages → Source = "GitHub Actions"** (not a branch).
> - **Settings → Environments → github-pages → Deployment branches** must allow
>   `main` (the default protection rule otherwise silently rejects deploys).
> - Default branch is **`main`**; keep `package-lock.json` committed so CI's
>   `npm ci` is reproducible.

## Conventions

- **Additions & improvements only — never a regression (STANDING RULE).** Every
  change must *add* a game/feature or *improve* existing behavior. It must never
  remove or break something that worked, shrink test coverage, or regress the
  guardrails. Go deep, be comprehensive, and be honest about what was and wasn't
  verified. If a change would trade away existing behavior, stop and flag it.
- **Static and dependency-light.** Plain HTML/CSS/JS. Don't add a framework or a
  build step without checking with the user first.
- **Kid-first & accessible.** Big targets, high contrast, alt text/aria labels,
  respect `prefers-reduced-motion`, sound off by default.
- **Keep it joyful.** When in doubt, make it friendlier and more forgiving.
- **Placeholders are fine — label them loudly.** Mark any placeholder content
  with a `⚠️ PLACEHOLDER` comment in `content.js` and remind the user until real
  content arrives.

## Notes for AI Assistants

- **Before building or changing a game, read [`JOSH_PROFILE.md`](JOSH_PROFILE.md).** It defines Josh's
  current skill levels (what to challenge vs. reinforce), his friends/interests to personalize with, and a
  skill→game-mechanic menu. This file is *how to build & ship*; that one is *what to build & how hard*.
- Follow the six PROJECT RULES above on every task. They are the heart of this
  repo's workflow.
- This is a personal, non-commercial, for-fun project — optimize for charm,
  forgiveness, correctness, and shippability.
- Keep this file updated when structure, behavior, or workflow changes.
- Don't open a pull request unless explicitly asked — push straight to `main`.
