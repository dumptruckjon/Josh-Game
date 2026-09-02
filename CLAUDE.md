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

**ENUMERATING THE 40 STAR-TREE NODES AGAINST THE TEST SOURCES FOUND FOUR THAT NO
TEST NAMES — and hunting them turned up a real defect two files away, where
❤️ Extra Hearts had moved a number that two player-facing strings printed
literally.** The enumeration is the `cheap` lesson generalised: that mode's
description was written from its identifier and shipped false, so the question
became *which other player-facing claim has nothing driving it?* Abilities,
chips and targeting all came back fully covered; the tree did not. **`earlycall`,
`ricochet`, `fieldrepair` and `quickmarch` appear in no test at all** — they pass
the two derived laws (every node changes `metaMods`; every `metaMods` key is read
inside `createEngine`), which prove a READ SITE EXISTS and say nothing about
what the read does. Driven, **all four are correct** (Early Bird ×1.504, Ricochet
4 → 5 bodies, Field Repair 75 → 38 ticks, Quick March ×1.6), so this half is
coverage rather than a fix — the honest half to write down, because the next
author needs to know the hole was the suite. The derived guardrail now requires
every node to be NAMED by some test, comment-stripped for the fourth recorded
time (a scan must not count its own documentation).
**The defect it led to: `UI.showVictory` printed `lives + " of 20 stickers kept
safe"`, and a run carrying Extra Hearts II starts at 24 — so a flawless win
rendered the literal nonsense "24 of 20".** The 🛡️ No Leaks badge said "Win a
level with all 20 lives" while the code awards on `!cur.leaked`, which is wrong
in BOTH directions: 20 is not the total for an Extra Hearts run, and a 🌟 Sticker
Shield run can finish with every life it started and correctly NOT earn it. This
file already recorded the underlying law from the BALANCE side — *"lives
REMAINING is the wrong metric the moment the meta can change the starting
total"* — and had never applied it to the strings. Third instance of ASK THE
ENGINE after the sell refund and the per-wave charge; fixed the same way, with
one `maxLives()` the state init, the 🩹 Patch Kit cap and the UI all read.
**The codebase already disagreed with itself, which is the tell this file keeps
naming**: `cur.lives0` existed for the danger-music threshold, carrying a comment
saying in as many words that the total *"cannot be derived from RULES.lives —
❤️ Extra Hearts starts you higher"*, while the victory screen four hundred lines
away printed 20. Same shape as the wake lock's `visibilitychange` handler testing
`!cur.paused` while nothing enforced it. `lives0` is retired onto the owner.
**Widening the ASK-THE-ENGINE scan then found a FOURTH site**: the CALL button
read `const bonus = info ? info.bonus : Math.ceil(secs * RULES.earlyCallRate)`,
and ⏩ Early Bird multiplies exactly that rate by 1.5 — so whenever the fallback
was reached it understated an owning run by a third. The fix is not to correct
the arithmetic but to delete it: a figure comes from the engine or it is not
shown, and the button falls back to showing the clock alone. **Three of the four
sites in this class have now understated rather than overcharged**, which is why
only a test finds them — being handed more than the label promised produces no
bug report. The scan is per-RULE rather than per-file so the Toybox Guide can go
on quoting `chargePerWave` (it explains the MECHANIC), and it needed one clause a
named-rule scan structurally cannot provide: replacing `maxLives() * 0.3` with
`20 * 0.3` is invisible to it, so both consumers are COUNTED. A count is not a
tuning pin — a third consumer keeps it green and dropping one is a conscious act.
**Cross-referencing every `metaMods` key against the values read outside the
engine found no fifth live site, and three deliberate non-fixes worth naming so
nobody "corrects" them**: the Toybox Guide quotes the BASE night penalty, the
BASE ability radius and each enemy's BASE bounty, which 🦉 Night Owl, 💣 Wider
Blast and 🪙 Bounty Hunter respectively move — and the guide is opened from the
fort home where no run exists, so the base is the only number it can honestly
state, and each node's own text says it grows them. Every LIVE surface is
already right: the range ring asks `rangeMul`, the blast fx reads the radius off
the ability EVENT (which the engine emits pre-scaled — the TD-6
put-the-datum-on-the-event rule paying off), and the power strip's countdown
subtracts from `state.abilityCd`, the engine's own STAMPED value, so ⏱️ Fast
Hands is baked in before the UI ever sees it.
**And the same sweep found a THIRD sibling breaking a law its own comment
states.** `writeMidRun` stores `powers` and `chips` read off the RUN — each with
a comment saying so, "so a loadout edited while a run is parked cannot
retroactively rewrite the run that is being restored" — and the line between
them read `meta: activeLoadout()`, which reads the SAVE. Verified reachable
rather than assumed: `writeMidRun()` fires at EVERY wave boundary (phaseWatch),
so park a run, respec on the fort home, resume, clear one wave, park again — the
second checkpoint carries the NEW loadout while the live engine is still running
the old one, and the next resume silently changes the run's rules. With the
victory string now honest it surfaces as "24 of 20" by a different door. Two of
three siblings had the right policy and one did not, which is the shape that
gave `hurriedMult` two writers and drifted the wake lock's acquire and release
apart. Its fixture needs no seeding, which is what makes the test sharp: a fresh
save owns nothing, so `activeLoadout()` is `[]` while the run holds two nodes.
**And the RESTORE side had the same smell on a single line**: `startLevel(...,
meta: mr.meta, powers: Array.isArray(mr.powers) …, chips: Array.isArray(mr.chips)
…)` — two of three guarded. Measured rather than assumed: `metaMods` opens with
`new Set(meta || [])`, so a `meta` of `{}`, `7` or `true` throws *"is not
iterable"* inside `createEngine`, i.e. tapping Resume on a hand-edited or
truncated 💾 Backup breaks the fort, which is precisely the class the `towers`
and `waveIdx` guards were written for. Guarded now — and deliberately NOT with
powers' `&& .length`, because an EMPTY loadout is a real choice and falling back
to `activeLoadout()` there would hand a deliberately-empty run whatever is
equipped now, reintroducing the bug fixed one function up. **Three fields on one
line with two policies between them is the same shape as `hurriedMult`'s two
writers and the wake lock's drifted acquire/release — when you find one sibling
misbehaving, read the whole row.**
**Two METHOD failures in the same sitting, and both produced a green result that
meant nothing.** (1) **An absent process does not mean "not started yet".**
`node --test` buffers each file's TAP, so `td.test.js` had already RUN and
flushed nothing, while `pgrep` showed only the still-grinding `td-logic`. I read
that as "it is queued" and edited both the test file and `td-main.js` mid-run —
so the suite's 733/733 covered neither of the two newest tests nor the edits, and
its verdict on that file was unattributable. The tell was in the final log's test
NUMBERING, not in the process list. Either finish the run before touching
anything, or re-run the specific file afterwards; do not infer scheduling from
`ps`. (2) **A fixture that hand-edits `localStorage` while a run is PARKED does
not stick** — the live module holds its own `save` and rewrites it, so all four
corrupt-meta values were replaced by the healthy one before the reload and Resume
ran against a perfectly good checkpoint. Four clauses passed VACUOUSLY. It
surfaced only because a fifth clause expected a value the clobber could
contradict (an EMPTY loadout came back as `["lives"]`) — otherwise the whole test
would have shipped proving nothing. The run is dropped by a reload FIRST now, and
the seed is read back after a second reload and ASSERTED, so the precondition
verifies itself instead of being hoped for. Both halves are then mutation-proven,
and the guard's mutation reproduces the exact `object is not iterable` throw the
engine probe predicted.

**AND THE INSTALL STALL WAS FINALLY ATTRIBUTED, by reading a log line rather
than re-tuning a constant for the fourth time.** Three more stalls landed the
same day (53m32s, 26m35s, and one 49-minute run in flight), and the decisive
datum is in run #328's own log: **"Cache hit occurred on the primary key
playwright-Linux-…"**. The cache HIT, so that 53-minute install downloaded
nothing — run #326 proves the healthy shape of a hit at **29 seconds**. So the
CDN is off the critical path exactly as intended, and what is left to stall is
apt, which is what this file already predicted when the cache landed. The
combined `npx playwright install --with-deps` could never say that, so the two
halves now run as separate labelled commands inside ONE `timeout`: the
per-attempt budget and the `3 x PER_ATTEMPT < backstop` arithmetic are
unchanged, and a killed attempt leaves its phase marker as the last line. **This
is diagnosis, not a re-tune** — and note the bound was NOT touched, because the
retry keeps recovering (run #328 succeeded on attempt 3, the second time that
has happened) and this file's own rule is that a bound is not raised without a
run that made all three attempts and ran out of TIME rather than out of luck.
The behavioural guardrail needed no rewrite, which is the tell that the change
is minimal: its flaky stub short-circuits on a failing first phase, so the
per-attempt counting still holds. Three new clauses pin the split (no
`--with-deps`, both phases named, exactly ONE `timeout`), each mutation-proven —
the last one because a second `timeout` would silently double an attempt's cost
and break the arithmetic against the caller's `timeout-minutes`.
**Four method notes, and three of them are traps this file already names.**
(1) **The flattening trap, twice in one sitting, written by the person who
documented it.** Quick March's clause derived its expected ratio from
`metaMods(...).marchMul` — the very mod under test — so neutering it to 1 made
the expectation 1 too and 1.000 ≈ 1.000 passed. Then the same shape recurred on
`maxLives()`: once the state init asks the owner, `maxLives() === state.lives`
is self-satisfying, and only an explicit *"Extra Hearts II must genuinely move
the total"* clause catches a neutered accessor. Both now carry a second clause
that cannot flatten. (2) **Two fixture bugs each produced a confident null on a
working engine** — `engine.upgrade()` takes a tower **ID** while `__TD.script`'s
`upgrade` op takes an **INDEX**, so a probe that passed 0 silently measured a
tier-1 fan and reported Ricochet worth nothing; and a Loose Screw's sap fires
every 7s while the screw WALKS 5.6 cells in that time, clear of its own 3.5-cell
radius, so "it never jams" was the fixture, not the node. Both fixtures are now
self-verifying (assert the branch took; assert the gun is inside the sap radius).
(3) **A mutation harness must compare the STRINGS, not the byte count** — three
of these mutations are same-length, and the length check alone reports a clean
skip that reads exactly like a passing clause. (4) **A `cancelled` CI run is
ambiguous and this file only documents one cause.** Run #327 came back cancelled
with a ~2-minute duration because `concurrency: pages` keeps at most ONE pending
run and a third push evicts the middle one — queue collapse, harmless on a linear
main because the tip run carries the evicted commit. The hang looks different: it
sits for tens of minutes behind a run stuck in install. Check the duration and
whether a successor exists before hunting a stall. **(5) And an IN-PROGRESS run's
age is not its RUN time — it is mostly QUEUE time, which is a third way to
misread this.** Run #335 showed 60 minutes elapsed with #336 stacked behind it,
which is the exact signature this file describes for a hung install; it was
nothing of the kind. Its `created_at` was 04:36 and its job's `started_at` was
05:28, so 52 of those minutes were spent waiting on the `pages` concurrency
group, and the install itself took **50 seconds** on a cache hit. The run object
and the JOB object answer different questions: `run.created_at` is when the push
happened, `job.started_at` is when a runner picked it up, and only the difference
between a step's own `started_at`/`completed_at` is time the build actually
spent. Read the JOB before touching `PER_ATTEMPT` — the bound has been re-tuned
three times in this repo, twice on evidence that turned out to be about
something else, and the note beside it already says not to raise it without a run
that made all three attempts and ran out of TIME rather than out of luck.

**NOTHING IN THE FORT EVER NAMED THE STAR THRESHOLDS — a player finishing at 2★
had no way to learn that 18 lives was the bar.** `RULES.stars` is
`[[18,3],[10,2],[1,1]]` and appears in no player-facing surface at all: the
victory screen showed the stars you got and the stickers you kept, and never the
number you were being scored against. Same gap the ⬆ preview closed for
upgrades, where the most frequent decision in the game showed a price and not
what it buys. The engine owns the arithmetic (`starGoal()` — the ask-the-engine
law), it is written ORDER-INDEPENDENTLY on purpose (reversing `R.stars` gives
identical answers at every life count, so the fact that it is authored
descending today is not load-bearing), and it returns null at 3★ where there is
nothing to say. Three things worth keeping. (1) **The fixture was settled by
MEASUREMENT and it inverted my assumption**: I had recorded that `winL1`
finishes L1 at 19 lives / 3★ — that number was actually from a different probe
build (6 darts, no upgrades). Replaying the SHIPPED plan headlessly across four
seeds gives **16 lives / 2★**, so the hint's render path is reachable through
the existing hook, and the SAME plan on casual gives 19-20 / 3★, so the absent
branch is reachable too. Had I not re-measured, the test would have exercised
only the absent branch while looking thorough — and the fallback I was about to
reach for (calling `showVictory` with a constructed argument) is the shape this
file already records as unable to see its producer break. (2) **Reuse a style
that is already contrast-audited** rather than inventing a class: the line takes
`.td-sum__line`, so it adds no new AA risk to an overlay the fort's contrast pass
already walks, and carries a second class purely as the test's handle. A brand
new text run in a dialog is exactly what an audit scoped to known surfaces
misses. (3) **A HUD readout was considered and REJECTED**: knowing mid-run that
3★ is already gone is arguably more useful, but `.td-hud` is the documented
reflow-sensitive surface (the ⚙️ button jumping between rows), and buying that
risk for a number the victory screen can state honestly is a bad trade.

**ENUMERATING THE 19 ACHIEVEMENTS THE SAME WAY FOUND 14 NAMED IN NO TEST — and
the useful part is the constraint that decides which of them are worth
driving.** They are not one shape: `earnAch` is reached through SIX distinct
wirings (a level-id on win ×11, four separate run-context reads, an endless
score with three call sites, a live event, a slow-count sampler, and the star
totals), and only two were driven — `doorman` for the level-id shape and
`firstblood` for the event. A structural scan already proves every declared
badge has an `earnAch("id")` call site, which is the "a scan proves a CALL SITE
exists" half; nothing proved the other four wirings fire.
**The constraint: A BADGE TEST CANNOT CHEAT.** `awardWinAchievements` is skipped
on a cheated run and `__TD.grantGold` sets `cheated`, so the cost of driving a
badge is the cost of LEGITIMATELY winning the level it needs — which is why
every gold-less probe of a bespoke build lost, and why `winL1` exists at all.
Measured against that, three shapes are cheap and four are not: `noleaks` falls
out of `winL1` on CASUAL (20 of 20, zero leaks) with the same plan on normal
finishing at 16 as its negative control, `heroicheart` out of `winL1` on heroic,
and the star totals out of a seeded save plus any legitimate win. `peapurist`
(a darts-only L2), `dysondenied` (an L8 win losing ≤3 soldiers), `iceage` (20
bodies slowed at once) and `marathoner` (endless wave 20) each need a bespoke
winning plan for one level or mode, and are recorded as expensive rather than
quietly skipped.
**The star-total clause is the one that matters, and it is falsifiable only
because of the one-short seed.** Its cap is `LEVELS.length * 3`, the derivation
this file records replacing a literal 36 that would have fired 👑 Full Fort a
whole world early — and with 40 levels a stale literal makes a 119-star save
clear its cap and award wrongly. Seeding to the ceiling proves the badge fires;
seeding ONE star short is what proves the ceiling is still derived. A test that
only seeds the full amount passes on both the correct and the broken version.

**TWO MORE BADGES WERE UNDRIVABLE, AND NEITHER WAS BLOCKED BY THE GAME — the
TEST HOOK was skipping side effects the real loop and the real UI perform.**
Having scoped four badges as "expensive", I re-measured instead of trusting my
own note, and two of the four are cheap. **🧊 Ice Age needs no win at all**: it
is the only badge sampled PER FRAME rather than awarded at an outcome, so it
wants 20 bodies slowed at once and nothing else — and a fan on every pad, funded
by the level's OWN start gold (`place()` refuses what you cannot afford, so it is
not a cheat, and a cheat would suppress every award), peaks at **23 slowed on L32
by wave 4**. **🎯 Pea Purist** likewise: a dart-only board wins L2 legitimately at
16 lives. What blocked them was `__TD.script`, which is how every fort test
advances the engine: it runs `afterTick`/`drainEvents`/`phaseWatch` and **never
the Ice Age sampler, which lived inline in `loop()`**, and it calls `e.place()`
directly, which does **not** write `cur.lines` — that is the build BUTTON's job,
so a scripted darts-only win left the line set EMPTY and Pea Purist could never
fire. Both are one-owner fixes now (`sampleIceAge()` called from the frame loop
and both scripted tick paths; `place` recording its line), and the mutations
reproduce the pre-fix states exactly — `got ["firstblood"]` and `got []`.
**The general law: a hook that stands in for the main loop must reproduce its
SIDE EFFECTS, not just its ticks** — the "a harness is only as faithful as its
INVOCATION" lesson, moved from a shell to the tick loop. The tell was already in
the tree: `resumeMidRun` carries a comment saying it repopulates `cur.lines`
"rebuilt via engine.place(), not the UI handler", i.e. a third site had already
hit this and worked around it locally instead of fixing the seam.
**And the guardrail's first clause was a false-positive machine**, which is the
failure this file keeps naming: it asserted that no site OTHER than the sampler
carries a `tick & 7` gate, and the HUD has its own unrelated ~4Hz throttle
written with exactly that idiom, so it flagged working code the first time it
ran. The honest form is POSITIVE — assert the gate and the once-only/honest-run
guards live inside the owner's own body, so a call site cannot forget them.
Prefer asserting what a thing must BE over enumerating what everything else must
not be.
**Container note, paid for in re-work: the snapshot rollback takes `/tmp` WITH
it.** This session parked a finished, mutation-proven change as patch files in
the scratchpad while a gate ran; the clone rolled back mid-gate and the scratch
files were gone too, so the whole change had to be re-derived from scratch. The
writable disk is one restore unit — the repo and the scratchpad die together.
Staging work outside git is not staging it anywhere; commit early on a branch, or
accept that an interrupted change is lost.

**ALL FOUR BADGES I HAD SCOPED AS "EXPENSIVE" WERE CHEAP — the scoping note was
wrong on every one, and re-measuring instead of trusting it is what found two
real defects.** The note said `peapurist`, `dysondenied`, `iceage` and
`marathoner` each needed a bespoke winning plan. Measured: **🧊 Ice Age needs no
win at all** (sampled per FRAME; a fan on every pad peaks at 23 slowed on L32 by
wave 4), **🎯 Pea Purist**'s dart-only board wins L2 at 16 lives, **🌪️ Dyson
Denied**'s L8 win comes in at 11 lives with **0** soldiers lost even on a
camp-free board, and **🏃 Marathoner** reaches endless wave 20 in **470 ms** of
sim. Two of them were blocked not by the game but by `__TD.script` skipping side
effects the real loop and UI perform (the sampler, and `cur.lines`); the other
two were simply never tried. **A scoping verdict is a claim like any other —
this one cost two shipped defects by looking authoritative in a note.**
**Marathoner needed a robustness check the others did not**: `startLevel` seeds
an ordinary run from `Date.now()`, so an endless test gets a RANDOM seed and
would be a coin flip if survival were marginal. **CORRECTED (2026-08): it WAS
marginal, and the "measured across 8 seeds × 2 arenas, so the fixture is safe by
measurement rather than by luck" claim that stood here was wrong — see the
sample-size entry at the end of this block. The seed is pinned now.** Its wiring
is also unlike
every other badge: it is awarded when the run ENDS or when you LEAVE, never on a
win, so the test has to walk out of the arena to collect it.
**All SIX earnAch wirings are now driven, and the seven badges still named in no
test are a deliberate stop, not a gap**: `windeddown/toolsdown/notleaving/
gooddog/scrapped/pressed/unwrapped` are the level-id siblings for the L12-L40
boss finales, and that wiring is already driven twice (`doorman` on L1,
`bossbonker` on L4). Driving each would mean legitimately winning eight more
finales for a shape already proven, while the declaration scan separately
guarantees every badge has a call site. Cover a WIRING, not each of its
instances.

**THE FORT NEVER TOLD YOU WHAT A LEVEL DOES TO YOU UNTIL YOU WERE INSIDE IT —
and the loadout is chosen on the screen that stayed silent.** `levelGimmicks`
has been derived since TD-16 and had exactly ONE consumer, the Toybox Guide, so
learning that L14 is a night level meant opening the guide and cross-
referencing. That matters because the ⭐ tree slots, the 🎒 powers and the 🎖️
chips are all picked on the fort home BEFORE you enter: "this one is a night
level" is precisely the cue that says pack 🦉 Night Owl. The card now carries a
derived trick strip (32 of 40 levels, max 3 icons), named in an `aria-label`
because a `title` is hover-only on a phone. Four things worth keeping, and three
of them are my own mistakes.
(1) **My BASELINE was not comparable, and it hid a real defect.** I measured the
grid on a fresh save — where most cards are the shorter LOCKED variant — and
compared it against an unlocked state, then reported "zero layout cost". The
honest A/B is the same state with the strip `display:none`, which does measure
byte-identical (card, grid, home, overflow, at 320/390/834). Compare like with
like, in the state the feature actually appears in.
(2) **The first cut was an absolutely-positioned corner badge, and it collided.**
It measured free and then sat on top of the level number at 320px on exactly the
two 3-gimmick levels (L7, L18). Sharing the number's flex row makes non-overlap
STRUCTURAL rather than a matter of arithmetic that holds at one width — and it
still costs no row, because the number's row already existed.
(3) **The collision clause could not FAIL at the test's own viewport.** The
overlap only happens at 320 and the fort browser tests run at 390, so restoring
the colliding CSS passed the mutation. "A viewport list IS the test" landing on a
check written minutes earlier; the clause now measures at 320 too, where the card
is narrowest, and the mutation goes red. (It fires on either overlap OR escaping
the card, which also catches the positioned-parent trap, since the corner badge
needs a `position: relative` ancestor the flex version does not.)
(4) **An alias is scoped where it is declared**: `const L = global.TDLogic` lives
inside the guide function, so calling `L.levelGimmicks` from the level grid threw
a ReferenceError and rendered ZERO cards. The measurement caught it instantly —
which is the argument for measuring the render rather than reading the diff.

**AND THE OBVIOUS COMPANION FEATURE WAS MEASURED AND REJECTED — a flier warning
in the next-wave preview.** The reasoning for it is strong on paper: only Dart
and Fan reach air, a mortar-only board is the mistake this file documents most,
and the DEFEAT screen already diagnoses it after the fact ("Nothing you built
could even reach the Kite Hawk"), which is a diagnosis arriving one wave too
late. The 🚪 side-door marker exists on exactly that argument — a flank has to be
ANTICIPATED, not discovered. The numbers say air is not the same case: a 🚪 flank
appears in **16 of 542 waves (3%)**, which is why it reads as a signal, while a
flier appears in **297 of 542 (55%)** — a marker that fires on more than half of
every preview is noise, not information. The decisive figure is the third one:
**0 of 542 waves are mostly air** (>60% of wave hp), so a per-wave warning could
never be the fact that decides the wave. Mortar-mono was a whole-CAMPAIGN
coverage gap, not something a player reacts to one wave ahead, and the counter
matrix is already stated where that gap is actually made — the Toybox Guide and
the build menu's role lines. **The same scan cleared a worry rather than finding a
bug**: the widest preview today carries EIGHT distinct enemy types (L11 w15), and
🧭 Scout Report doubles it to sixteen, which looked like the documented
iOS-wider-emoji spill waiting to happen — but the pill already carries
`max-width: calc(100% - 16px)`, `white-space: normal` and `pointer-events: none`,
so the worst case wraps downward at no cost. Both results are recorded because
the next author reading that preview will have exactly this idea.
**One more non-change, with its budget written down.** The level card's trick
strip renders at **9.9px**, which is precisely the size of the difficulty pips
already beside it, and the tightest card in the game (L18's three icons at 320px)
uses 53 of 91px — **38px free**. Bumping it for legibility was considered and
dropped: it is at parity with the card's own secondary type, there is no measured
defect, and no guardrail for it exists that is not an invented threshold — the
unfalsifiable-change trap this file already deleted twice. The headroom number is
here so a future author who does want a bigger glyph knows what they have to
spend.

**ASKED WHETHER ANY TD WORK WAS STILL OPEN, THE HONEST ANSWER TURNED OUT TO BE
"FIVE PLAN DOCS SAY SO, AND ALL FIVE ARE LYING" — and the guardrail written for
exactly that class was blind three separate ways.** The docs: `PLAN_ROAD_TO_140`,
`_180` and `_200` all said PLANNED / not-yet-built with Josh's **200 games live**
(counted off the running registry: 240 total, 200 + 40); `PLAN_TOWER_BRANCHES`
said *"everything else DESIGNED, NOT BUILT … no new branch has been added"* with
🎯 Rust Ray and 🧊 Tail Wind both in `DATA.TOWERS` (10 branches, not 8); and
`PLAN_EXPANSION` said *"Status: PLAN. Nothing here is built"* with phases 1-5 and
P6a-P6d all verifiable in the shipped data (`abilitySlots`, 📌 Call the Shot, 🦆
`zapResist`, ⛱️ `zones[].dmg` on L2/L18/L26, 🛢️ `spill`, Worlds 7-8, ⚙️ energy).
That is the fifth through ninth instance of a list outliving its contents.
**The guardrail could not have caught any of them, for three compounding
reasons, each worse than the last.** (1) Its file glob was `PLAN_WORLD_*.md`, so
nine docs were out of scope — the file list is part of the scan, again.
(2) It read the verdict with `/Status:\s*\*\*(.+?)\*\*/`, which only matches
`Status: **X**`; half the docs write `**Status: X**`, so it silently skipped
**7 of 14 — including PLAN_WORLD_9 and PLAN_WORLD_10**, the very shape it
polices. (3) Worst: it detected the world with the literal pattern
`` world `key` ``, which appears in **exactly one doc — PLAN_WORLD_4, the one it
was written against**. So a check that reads like a law was a single-case
assertion, and W9 or W10 could each have claimed NOT BUILT with all four levels
live. The world now DERIVES from the filename (a world is four levels, so
`PLAN_WORLD_<N>` is levels 4N-3..4N — if level 4N is in `DATA.LEVELS`, it
shipped), which needs no prose at all, plus a `verdictsRead >= 12` floor because
a derivation fails OPEN and this one had been failing open all along.
**Three of my own mistakes fixing it, all previously documented classes.** My
first widened extractor took the whole sentence and false-positived on
PLAN_WORLD_4's CORRECTED header, which quotes the words *"NOT SHIPPED"* while
explaining that it used to say them — the precise false positive this file warned
about; the verdict is now cut at the first clause boundary. I named the counter
`read`, which SHADOWS this file's own `read()` file helper and threw
`Cannot access 'read' before initialization` from the unrelated half of the same
test. And the mutations I ran to "prove" the fix all passed against
`--test-name-pattern="outlived"` — a word that appears in the assertion MESSAGE
and not in the test NAME, so node ran the file with zero subtests and printed
`# tests 1 / # pass 1`. That is the documented pattern-matches-nothing trap,
committed by the person who wrote it down, and the tell was `# tests 1` on a
68-test file.

**THE SCRIPT THAT SAVES THIS SESSION FROM THE ROLLBACK HAD ZERO COVERAGE, AND
ITS FAILURE MODE IS SILENCE.** Auditing the sibling half of the plan-status test
found that `.claude/resync-main.sh` and `.claude/settings.json` were mentioned in
exactly ONE place in the whole suite — the tree check's hand-written allowlist,
which ADDS them to the "this exists" set by fiat. So nothing checked that the
hook existed, and nothing checked it was WIRED. That is the worst shape a gap can
take here: the hook is what heals a container that came back on a stale clone,
which happened twice in one day and destroyed a finished, mutation-proven change;
if it silently stopped firing, no test would go red and the only symptom would be
work quietly disappearing again. The forward walk now collects `.claude` (so
existence is DERIVED and the allowlist shrinks by two — deleting the script is
caught), and a new guardrail asserts the wiring plus the four SAFETY properties
that make auto-running it acceptable at all: it may only `merge --ff-only`, only
from a `--porcelain`-clean tree, only on `main`, and it must `exit 0` on every
bail-out so a network blip at SessionStart cannot wedge the session. Every one is
mutation-proven — un-wire the hook, weaken the clean-tree test, turn the
fast-forward into a `reset --hard`, or let it act on any branch, and it goes red.
**Two of my own assertions were too weak on the first write, both in ways this
file already names.** `/porcelain/` still matches `porcelainXX`, so the mutation
that neutered the clean-tree check passed — a substring test is not a word test.
And the `reset --hard` ban had to be COMMENT-STRIPPED, because the script's own
header explains why a blanket hard reset would be wrong, so the scan matched its
own documentation for the fifth recorded time.
**AND DRIVING IT — the other half of the standing pairing — found a real defect
the structural scan could not see, in the branch the scan proves hardest.** A
scan proves the idioms are PRESENT; only running the script proves what they do,
so it is now driven through all six of its branches in throwaway clones (a bare
origin + a clone, ~0.6s). Five went red on the obvious mutations. The sixth,
**forcing the `merge-base --is-ancestor` test true so an AHEAD clone is treated
as a rollback, PASSED** — and chasing that instead of widening the tolerance is
what found the defect: `merge --ff-only` REFUSES to rewind, so unpushed work
survives a broken ancestor test on its own. **The `--ff-only` flag is the SAFETY;
the ancestor test is the CLASSIFICATION** — and mis-classified, the most ordinary
state in the world ("I committed and have not pushed yet") opens the session with
`⚠️ the fast-forward failed. Resync before trusting local files`, sending the next
session hunting a rollback that never happened. That is the false-positive machine
this file keeps refusing to ship, so the WORDING is now the assertion (it must
name unpushed work, and must never say *failed*), and the mutation goes red.
Two smaller things worth keeping. **A case can pin an OUTCOME that two guards
both deliver, and saying so is part of the test**: running outside a git tree is
silent because of `rev-parse --git-dir` AND the `|| exit 0` on the branch read, so
removing either alone stays green and only removing BOTH turns it red with
`fatal: not a git repository` as the session's opening words — measured, and
written into the comment rather than left as an implied seven-for-seven. And the
same run re-confirmed the newest habit: every mutation asserts its anchor appears
exactly once and that the file actually CHANGED before the result is believed.

**ENUMERATING `DATA.RULES` — the one config surface never swept the way abilities,
chips, nodes, badges, targeting modes and engine exports have been — found 21
keys, none dead, and THREE named in no test. Two of the three turned out to be
covered behaviourally anyway, and chasing the difference is where the real hole
was.** `flierSlowFactor` is pinned by a slow test asserting 0.15, and
`brittleBonus` by `computeHit(10, "bonk", {brittle:true}) === 12` — so the
name-scan is a proxy and had to be checked, not believed. But `brittleBonus` has
a SECOND read site — **the Fan's beam**, where the accumulator spends WHOLE
points and `Math.round(1 × 1.2) = 1`, the documented bug where brittle and
👊 Boss Bonker *"did literally nothing on a Fan"*. I wrote that seam up as having
NO guardrail, on a grep of the tests for `brittle`. **It has one, and the
mutation run is what told me so.** `AUDIT combat: the Fan's beam keeps its
multipliers` caught the brittle mutation immediately; my grep had missed it
because the pipeline ended in `| head`, which is the "a scan's own pattern is
part of the scan" law landing on the SHELL rather than on the regex — a truncated
scan does not report that it truncated. **Verifying a hole instead of arguing it
is the entire reason that claim did not ship.**
What the run then made measurable is better than the hole I thought I had. The
shipped test asserts `brittle > plain` over a whole WAVE, so it goes red when the
multiplier is deleted and stays **GREEN at 1.10 and at 1.15 against a declared
1.20** — an inequality cannot see a bonus delivering half its strength, and its
quantity is confounded anyway (total fan damage over a wave is bounded by the
wave's own HP and moves with kill timing). And it does not touch 👊 Boss Bonker,
which rides the same accumulator line: dropping `zapBoss` leaves the entire
shipped suite green, and an exhaustive grep of the `"bossdmg"` meta id confirms
nothing anywhere drove it through a beam. So the new test pins a single body in
range and reads the RATIO, with a control clause that a non-boss beam target is
untouched — mutation-proven at 1.10, 1.15, `zapBoss = 1`, and a blanket
`mods.bossDmg`. **Two lessons, and the second is the one worth carrying: an
INEQUALITY is not a MAGNITUDE.** A test that proves a multiplier exists is not a
test that it is the multiplier you declared, and for anything applied at a
ROUNDING seam that gap is exactly where the original bug lived.
**The third rule was the sharpest, because it is not a rounding subtlety — it is
the single most load-bearing number in the opening, and nothing named it.**
`buildCountdownFirst: 45` against `buildCountdown: 20` is not "time to get
settled": the early-call bonus is `ceil(secondsLeft × earlyCallRate)`, so the
FIRST countdown sets the ceiling on the wave-1 bonus at **135🪙 against every
later wave's 60🪙** — and this file's own front-loading audit quotes that exact
135 (*"≈ 2 extra opening towers … not a greed option, it was mandatory"*) and
re-tuned four levels' `startGold` around it. Collapsing the two rules into one
would quietly delete 75🪙 from every level's first decision with nothing going
red. Three clauses on purpose, and the mutations show why each is needed: the
PROPERTY (the opening is strictly longer, cannot flatten) catches a collapse; the
WIRING (bonus derives from countdown × rate) flattens on its own and is only safe
because of the first; and the PIN (135) is the only one that sees **both inputs
move together** — shaving 45 → 40 leaves clauses 1 and 2 perfectly happy and
fires only the pin.
**And the same sweep found the FLOOR law guarding one of a world's three declared
surfaces.** `every world's declared floor pattern has a renderer branch` exists
because the bedroom shipped `carpet` with no branch and painted bare — but `road`
is the field this file records THREE worlds silently sharing (they declared none
and fell through to the default wood), and it covers the strip the eye tracks for
a whole run. Widened to `pattern` + `road.style` + `props`; all three measure
CLEAN, so this is coverage rather than a fix, which is the honest half to write
down. The props half is the interesting one, because its failure is not blankness
but a WRONG PICTURE: the dispatch ends in an `else` that draws a floor STAIN, so
a new or mistyped prop name does not vanish, it paints a dark ellipse — and *"a
floor-MARK prop on a light floor reads as a HOLE"* is the defect that took `stain`
off World 10 a release ago. So the assertion is deliberately EXACT
(`undrawn deepEqual ["stain"]`) rather than an allowlist: the moment a second prop
joins the fall-through it goes red instead of quietly widening. All four mutations
red, including one re-proving the original pattern clause survived the widening.
**Last, a JUSTIFICATION had gone stale by four worlds, in the one place that
cannot go red.** The Tail Wind radius test explained its number as *"at the fan's
own 2.4 aura a Tail Wind reaches NOTHING on 21 of 36 levels, median pad-to-pad
4.00 cells"* — measured today it is **25 of 40** at a median of **4.12**. The
conclusion held and the figures did not, which is this file's own recorded law
(*"a comment that justifies a constant can be REFUTED by later data, and a comment
cannot go red"*) landing on a test comment rather than on CI. Rather than re-type
numbers that will go stale at world eleven, the justification is now an ASSERTION:
the combat aura must strand at least a quarter of the campaign, or the radius has
stopped earning its own number and the branch is drifting toward free power. Its
first mutation **fired an EARLIER clause** — growing the aura to the radius trips
`R > auraRange` and never reaches the new one, the documented trap — so isolating
it needed an aura that stays *under* the radius and still strands nobody (4.4 →
`0 of 40`). The bar sits between the shipped 62.5% and the 5% at aura 4.0, and an
intermediate 3.6 correctly stays GREEN at 12 of 40, which is what makes it a
separation rather than a fence. One fixture note, the same class as the
upgrade-index/id trap: `place()` takes a pad **ID**, not coordinates, so the first
beam probe reported `bad-id` on all eight pads and looked like a broken engine.
**And the plan-status law shipped a release earlier turned out to be reading the
WRONG LINE — a mid-document SECTION status, hundreds of lines from the header,
being reported as the whole document's verdict.** `PLAN_TOWER_DEFENSE.md` — the
fort's foundational design, the first thing a new author opens — had no header
status at all, so the extractor's `match(/^.*Status:.*$/m)` found a per-phase note
on line 331 reading *"ALL 12 levels across 3 worlds SHIPPED (TD-4 done)"* and
scored the doc as read. It is not NOT-BUILT, so the law stayed green while the
document's actual header described **a name gate that was removed in 2026-07 and a
campaign of 12 levels that is now 40.** Two fixes, and the interesting part is the
one I did NOT make. The obvious repair is to scope the search to the top of the
file — and that is WRONG: three docs (GIMMICKS, WORLD_5, WORLD_6) legitimately
state their single verdict at the END, so a line-number window would make them
unreadable and the law would silently narrow to eleven of fourteen. The rule that
needs no heuristic is to read EVERY `Status:` line and prefer any that claims
NOT BUILT — a stale lie is a lie wherever it sits, and a genuine section status
that says SHIPPED cannot false-positive. Alongside it the coverage floor went from
`>= 12` to `=== planDocs.length`: with fourteen docs, `>= 12` permitted two to
carry no verdict at all, and a doc with no verdict is not merely unchecked by this
law, it is INVISIBLE to it. Both mutation-proven (strip the only Status from a
one-status doc → "1 plan doc(s) carry no readable Status verdict"; append a lying
status to the END of an honest doc → caught). The fort's plan doc now carries a
header verdict that says plainly it is the ORIGINAL design and points at what
superseded it. **Sixth instance of "a list that outlives its contents", and the
first where the stale text was hidden BEHIND a guardrail written for exactly that
defect — a scan that reads one match of many is a scan whose scope is a
coincidence.**

**PUSHING THE SAME ENUMERATION ONTO THE SURFACES NEXT DOOR: no dead config
anywhere, and the "named in no test" half found FIVE tower fields, of which two
were genuinely uncovered — plus two TEST NAMES that state numbers the data
contradicts.** Every field of `DATA.ABILITIES`, `DATA.TOWERS`, `DATA.ENEMIES`,
`DATA.CHIPS` and the meta nodes is read by the engine or the app, so there is no
`cheap`-shaped dead lever left. But `critMult`, `defaultTargeting`, `spinUp`,
`shellSpeed` and `zapDps` are named in no test — and, exactly as with
`brittleBonus`, the name-scan is a PROXY and had to be checked: three of the five
are driven behaviourally under other names (the Minigun's ramp IS `spinUp`, the
beam's 6 dps IS `zapDps`, a shell's flight time IS `shellSpeed`). The other two
were not. **`defaultTargeting` is declared on exactly two things — the Mortar
line and the Sniper Scope branch, both `strong`, against an `|| "first"`
fallback — and has two read sites, neither driven.** That is not cosmetic:
`AUDIT targeting is a LIVE lever` measures the best mode as worth 4-9 lives on a
boss finale, and the Sniper's own role text says most of its damage is WASTED on
small bodies, so silently opening it on `first` aims the game's biggest single
shot at whatever chaff is furthest along — the overkill failure the branch's own
warning exists to prevent, arriving through the back door. **`critMult` is the
INEQUALITY-IS-NOT-A-MAGNITUDE law landing again the same day it was written**:
the engine reads `dmg * (s.critMult || 1.5)`, both sides of that `||` ship, and
the existing 🎯 Steady Aim test asserts only that the biggest hit RISES — which a
1.05× crit satisfies. Now measured on the real hit stream: Sniper 85 → 213
(2.506× against a declared 2.5) and a plain tier-3 dart with 🍀 Lucky Darts
24 → 36 (exactly 1.500×, the fallback). The non-flattening partner is the
interesting part of the design — both magnitude clauses DERIVE from the field
under test, so a `critMult` flattened to the default satisfies them both; the
clause that cannot flatten is that the branch's multiplier must genuinely BEAT
the default, and it is what turns that mutation red at `measured 1.506x`.
**And checking every numeric claim in a TEST NAME against the data found two
lies among thirteen.** Eleven check out (80% sell refund, ±25% budget, and four
separate 0.5s — flier slow, knight armour, tin-plane armour, the Vacuum King's
enrage threshold). The two that do not: `Overclock really doubles a tower's fire
rate, then wears off` — the shipped `mult` is **2.5**, and that body asserts
neither the size nor the wearing-off, both of which live in a sibling that
measures inside the exact `ab.seconds` window (this one's window is 8s against a
6s burst, so it straddles into the crash and can only ever support an
inequality); and `the speed toggle doubles it`, written before TD-14 made it a
1×→2×→3×→1× stepper, which its own body correctly checks. A test name is
documentation that runs, and it is the one kind that cannot go red — the same
class as the guide describing `cheap` from its identifier, one layer in.
**And cross-checking the fort's CSS classes against their users turned a
suspected defect into a measured NON-defect plus a real coverage hole — the
better outcome of the two.** Three sibling state modifiers are toggled on one
line of the ability strip, and only two are styled: `--poor` dims to 0.55,
`--armed` takes a gold ring, and **`td-abil--cool` is styled by nothing at all**,
which looked exactly like "the state you cannot fix by waiting is shown more
faintly than the one you can". It is not: `.td-abil__cd` is a FULL-TILE scrim at
0.78 alpha with the seconds centred on it, so the cooling state is the loudest of
the three and the class is a semantic handle. No change shipped — this repo has
deleted redundant paint twice for exactly this reason, and inventing a dim here
would have been a third.
What the same look found is that **the test asserting that state reads the
HANDLE while its own message claims the PICTURE** — `"…and the button shows the
cooldown"`, asserting `classList.contains("td-abil--cool")`, a class with no
style. Delete `.td-abil__cd`'s rule and the strip's entire refusal model goes
silent with the suite green, on the one control whose design brief was that a
refusal must never be a mystery. It now reads the element: visible, bigger than
20px square, and matching `/^\d+s$/`. Three mutations, and the middle one is why
the size check is there — collapsing the overlay to **1×1** leaves it
`display: flex`, `visibility: visible`, `opacity: 1`, so every naive "is it
shown?" predicate passes while the player sees nothing. **A visibility assertion
that does not measure a SIZE is not a visibility assertion.** The first cut of
that scan was also a false-positive machine worth recording: matching any `td-*`
token reported 54 "unstyled classes" that were element ids, `data-act` values and
the module filenames `td-main`/`td-render`/`td-ui`, and the four "dead styles" it
named were all built by string concatenation. Extracting only `className`,
`classList.*` and `class="…"` is what made the one real signal visible.

**THE PWA ICON CHECK CARRIED BOTH RECORDED DEFECTS AT ONCE — a hand-written list
AND a whole-file substring — on the surface that decides whether the app
installs at all.** It read `for (const icon of ["./assets/apple-touch-icon.png",
…4 literals]) assert.ok(sw.includes(icon))`. So a FIFTH icon added to the
manifest escaped it entirely, and because `includes` matches the whole file, a
path merely MENTIONED in a comment satisfies it — the identical bug already
fixed one test up, where CORE is parsed. Both are now derived (manifest `icons[]`
∪ the page's own `assets/…` references, checked against the PARSED array), and
mutation-proven three ways: an icon dropped from CORE, an icon present only in a
comment, and a genuine fifth icon that exists on disk and is not precached — the
last of which the hand list could not have failed on. One clause was deliberately
DELETED on discovery: "the manifest's icons are on disk" is already asserted
where the manifest is parsed, and a near-duplicate is noise rather than coverage.
**The same look found the sibling law half-derived.** The offline dead-shell check
takes `[...SCRIPTS, "styles/main.css", "styles/td.css", "index.html"]` — SCRIPTS
comes off `<script src>` for exactly this reason and the tail beside it was typed
by hand, so a THIRD stylesheet, or `manifest.webmanifest`, or any new linked
asset was outside the check that exists to stop the app booting empty offline. It
derives from every same-origin `href`/`src` on the page now (30 entries, measured
clean before the change, so it is a tightening of a passing check rather than a
newly-blocked build), and it keeps a clause asserting the derived set still
CONTAINS the scripts and stylesheets the old list named — because **a derivation
fails OPEN**: breaking the regex makes the whole check vacuous and everything
stays green, which the mutation reproduces as `the page-asset scan must find the
links (saw 0)`.
Two method notes. **A wrapper reported two of these mutations GREEN when they were
red** — its `--test-name-pattern` matched nothing and its fallback logic mis-read
the TAP summary, so the honest result only appeared on a direct run. That is "a
harness is only as faithful as its INVOCATION" landing on a throwaway mutation
script, and the tell was that MK1 failed with a message I did not recognise —
which is also how the pre-existing `existsSync` check was discovered. **When a
mutation result names an assertion you did not write, stop and find out whose it
is.** And the second: `cp` the file before mutating and restore in a `finally`,
never `git checkout` — this file already records losing a whole rebuild that way.

**QoL: THE FORT HOME BURIED THE ONE LEVEL YOU CAME BACK TO PLAY — and the three
FIXTURE defects found while proving it are worth more than the feature.** The
level grid is 40 cards on a ~2100px page and the route ends with
`scrollTo(0, 0)`, so from level 13 onward the next level to play sits below the
fold, and by level 37 it is **1668px down an 844px viewport** — measured, in view
at 0 and 4 beaten, out of view at 12/20/28/36. You return to this screen after
EVERY level, so the player who has invested the most scrolls the furthest, every
single time. The grid now tags that card while it builds (it is the one place
that already knows `playable` and `stars` — a second computation of "which level
is next" is how two owners drift) and the route brings it into view.
Two design calls are the interesting part. **A parked run OUTRANKS it**: the
Resume banner sits above the grid, so scrolling down puts it at **top −924**, and
a QoL change that quietly buries a better affordance is not an improvement — the
scroll declines whenever the banner is up. And the scroll is **INSTANT, not
smooth**: it fires while the screen is being entered, before the player has
looked at it, so there is nothing for an animation to explain, and 1051px of
smooth swoop is a long distracting slide nobody asked for. That also removes a
`prefers-reduced-motion` gate and an entire class of test flake.
**Three fixture defects, each of which made a clause pass vacuously or report a
false number, and each caught only by a mutation.** (1) **Browsers RESTORE scroll
position across a reload**, so running the deep case first left the next case
starting part-way down the page and reporting a scroll the feature never
performed. (2) **Setting `location.hash` to the value it already has is a NO-OP**
— no hashchange, no `route()` — so after the first case two of three clauses
never ran the feature at all and passed on nothing; the tell was the parked-run
mutation coming back GREEN. Hop away (`#__renav`) first, which is the pattern the
rest of this suite already uses. (3) **A stable-for-N-polls settle can conclude
BEFORE a smooth animation starts**, and it reported **2px of what was really a
1051px scroll** — which made a load-bearing guard look like it was worth two
pixels and nearly got it written off. With the scroll now instant, one frame is
the whole wait. And the "find the separating input" law applied again: at 0
beaten the card sits ABOVE the centre line, so centring it would scroll negative
and clamp to 0, making the already-visible guard unobservable — 4 beaten is the
input that separates the claims.

**QoL: NONE OF THE SEVEN FORT-HOME BUTTONS SHOWED A NUMBER, so "you have stars
waiting" was invisible until you opened the tree.** `starTotals(save)` has
computed `avail` all along and had exactly two consumers, both INSIDE the star
tree — the header that prints it and the affordability check — so in a 40-node,
140⭐ tree a player could sit on unspent stars, which are literally unused power,
with nothing on the screen saying so. The ⭐ button now carries the count, from
that same one owner. Three things decided the shape. **It is a CORNER BADGE, not
inline text**: at 320px that button already wraps to two lines, and appending
"· 12" risks a third and a grid that shifts under the thumb — measured, the badge
leaves all seven button heights byte-identical at 320 and 390 with no page
overflow, and a three-digit 120 (the campaign ceiling) still sits inside. **It is
drawn only when `avail > 0`**, because a badge that is always there is decoration
and one that appears when there is something to act on is a signal. And **the
count refreshes from `showStarTree` as well as the home render**, because the
tree's Done button only calls `closeOverlay` — the home is never re-rendered — so
without that second call site spending six stars would leave the button still
saying six, which is the single worst moment for it to be wrong. That staleness
is the mutation worth keeping: `120 -> 120`. Five mutations red, including one
that shows EARNED instead of unspent (caught by the same clause, since earned
does not move when you spend).
**The obvious sibling was REJECTED by measurement, so nobody re-adds it**: a
"🎒 2/4 packed" badge sounds like the same win, and `activePowers()` already
falls back to the first `abilitySlots` powers whenever `save.powers` is empty —
so a pack is NEVER under-filled, the interesting state cannot occur, and the
badge could only ever read 4/4, which is the decoration the rule above rejects.

**QoL: THE TOWER PANEL SAT ON THE BATTLEFIELD THROUGH THE FIGHT — and the two
routes into that state DISAGREED, which is this file's most reliable tell.** The
panel (and the build menu) is a bubble absolutely positioned over the field with
`pointer-events: auto`, so left open when a wave starts it both HIDES and BLOCKS
TAPS on a measured **21.2% of the battlefield** — precisely the ground an aimed
🧨 or 🍯 needs, at precisely the moment the fight begins. The ▶ CALL button
already cleared it; the build countdown simply RUNNING OUT did not. The rule now
lives in `phaseWatch`, one line below its exact mirror ("a wave ENDING must
disarm the power strip, or a half-armed power survives into the build phase") —
so one rule covers both routes, and opening the panel mid-wave is untouched,
because building and inspecting mid-wave is legal.
**Three fixture lessons, and the first is the sharpest.** My screenshot showed
the panel sitting over a live wave, which looked like the defect — but it was
`__TD.script(["call"])` bypassing the CALL button's own handler, so it was a
FALSE image that happened to point at a REAL bug by a different door. Driving the
actual button showed CALL was fine; driving the actual countdown found the bug.
**The harness's `call` op is not the button, and `script(["tick"])` runs with the
renderer paused and never reaches `phaseWatch` at all** — neither can answer a
question about how the UI REACTS, which is the "a hook that stands in for the main
loop must reproduce its SIDE EFFECTS" law landing on a screenshot. And the third:
the obvious over-closing mutation (`phase === "wave"` instead of the transition)
came back GREEN because it changes **no behaviour** — `phaseWatch` returns early
unless the phase actually changed — so the control clause had to be proven by an
over-close on the per-FRAME path instead. A mutation that alters nothing proves
nothing; when one passes, check whether it was even a different program.

**QoL: NOTHING IN A LIVE BATTLE SAID WHICH LEVEL YOU WERE ON.** Not the HUD
(hearts, gold, "wave 1/11"), not the pause menu ("Paused" and six buttons) — so
a resumed run, or one you came back to after a break, had no answer short of
quitting to the fort. It goes in the PAUSE MENU rather than the HUD for a
measured reason: the HUD is the documented reflow-sensitive surface whose column
widths were reserved to stop the ⚙️ jumping between rows, while the pause menu is
a vertical button list with room. Measured at the sizes that dialog has form
at — six buttons once overflowed a 390-tall landscape viewport with no scroll —
the extra line keeps the box on screen at 320×480, 320×568, 390×844 and
landscape 844×390, scrolling where the content is taller, with the last button
always reachable.
The interesting part is that it is a ONE-OWNER extraction, not a new string. The
resume banner already built this sentence inline, so a second copy in the pause
menu would have been two owners of "what is this run called" — and the drift is
not cosmetic: an endless `levelId` is a STRING like `"endless-bedroom"` that is
NOT in `DATA.LEVELS`, so a copy that forgets the endless branch throws exactly
where `UI.hud` once did, every frame. `UI.runLabel(levelId, endless, daily)`
carries the same `endless || !lvl` predicate the HUD uses, names the arena for an
endless run (`♾️ Endless · 🛏️ Bedroom`), the day for a 📅 Daily, and degrades to
`♾️ Endless` for an id it cannot resolve rather than building a label out of
`undefined`. Four mutations red, including the resume banner going back to its
own inline string, and a structural check that `runLabel` is defined once and
that both consumers read it.
**And the gate caught the new test LEAKING A PARKED RUN into the next one** —
which is worth more than the feature. Seeding `save.midRun` to check the resume
banner and never clearing it left a stale checkpoint behind, and a stale
checkpoint with no live run bounces `#td-play` straight back to the fort home,
so the FOLLOWING test timed out waiting for a screen that would never show. That
is precisely the symptom this file already records from the
`resetSave`-without-`dropRun` bug ("a later test navigating to #td-play then
bounced back to the fort home… which presented as an unrelated test timing out on
a hidden screen"), and it arrived by a new door: not a hook forgetting to drop a
run, but a TEST forgetting to. A fixture that seeds a checkpoint owns clearing
it, and the clean-up now asserts the banner is actually gone rather than hoping.

**QoL: THE ENDLESS PICKER'S OWN DEAD CODE NAMED THE FIX.** Screenshotting the
fort's dialogs found two copy defects in one list: an unlocked arena's best score
rendered as a bare **"🏆 12"** — twelve of WHAT — which is the ⚙️ Toy Energy class
(a number shipped with no name), and a locked arena read **"🔒 3⭐ the 4
levels"**, which has no verb and parses as nothing. The unit was already written:
the same function computed `const b = " · best wave " + best[w]` and **never used
it**, so the intent existed and the wiring had been lost. Now "🏆 wave 27" and
"🔒 3⭐ all 4 levels", and the dead variable is gone.
Two testing notes. **The COUNT half of the rendered clause is vacuous on shipped
data and the comment says so** — all ten worlds have exactly four levels, so
hard-coding `4` passes it (measured, not assumed); the WORDING is what the
browser test pins, and the DERIVATION is held by a structural check that can
actually fail. And the earlier-clause trap for the third time today: replacing
`n` with the literal `4` also broke the regex's shape, so it fired "the hint must
still be there" instead of "the count must be derived" — isolating it needed a
mutation that keeps the concatenation (`+ 4 +`) and changes only the value.

**THE FORT REMEMBERED EVERY PREFERENCE EXCEPT THE ONE WORTH LIVES.** Auditing
what persists — ⏩ speed, sounds, music, damage numbers, the difficulty chip, the
🎒 pack, the ⭐ loadout, the 🎖️ chips — left exactly one gap: the 🎯 targeting
mode, which reset to the line's default on every tower of every level. That is
the ⏩ speed defect's exact shape (*"a 2× player retapped on all 40 levels and
every restart"*) multiplied by 10-14 towers, on the lever `AUDIT targeting is a
LIVE lever` measures at **4-9 lives on a boss finale**. A new tower now opens on
the mode you last chose for THAT line. Three limits keep it a pure tap-saver
rather than new power: it lives inside `settings`, so the grown-ups reset's
`keepPrefs` clones it and the two-tab merge treats it last-writer-wins with no
eleventh top-level field; it applies only at `place()` time, because a tier-4
branch's own `defaultTargeting` (the Sniper's `strong`) is a declaration, not a
leftover; and it goes through the engine's `setTargeting`, so a `cheap`
remembered from before a 🔻 Weak Spot respec is refused (`locked`) and the line's
default stands. No sim moves — the auto-solver never calls `setTargeting` at all.
**The sharp lesson is where a WRITE test has to stand.** The persistence clause
first sat at the END of the test and deleting `persist(save)` left it GREEN:
`save` is ONE shared object, so by then any other `persist()` — the checkpoint,
a settings toggle — has flushed the same object and the clause passes with the
write at the site under test deleted. Read it at the moment nothing else has a
reason to persist (here, immediately after the choice, mid-build-phase); the
mutation then goes red. **A test that something was WRITTEN must run before
anything else writes the same object**, which is the "when a mutation passes,
find out what else moved" law applied to storage rather than to pixels. Three
more previously-recorded traps landed in the same fixture: the persisted-field
scan derives only TOP-LEVEL coercions, so a `save.settings.X` default was
outside the law that exists for exactly it (now derived too, with its own
non-vacuity floor); a `page.reload()` keeps the hash, so re-setting it is a
SAME-HASH no-op and the screen never routes; and a parked `midRun` bounces
`#td-play` straight back to the fort home, so a storage seed must clear it. And
the structural half had to be comment-stripped for the sixth recorded time,
because `applyAim`'s own comment explains the rule using the words it bans.
**A shell waiter can watch ITSELF.** `until ! pgrep -f "node --test"` never
terminated, because a second waiter's command line contains that literal string —
so each polled the other for ever, and a third one would have made it permanent.
The `pkill -f` trap in its polling form, and the tell was that the log had
already printed its own `# duration_ms`. Match the binary (`pgrep -x node`) or
watch the log's terminal line, never a pattern your own command line contains.

**THE 40-CARD LEVEL GRID NEVER NAMED A WORLD.** The fort gives each of its ten
worlds a floor pattern, a road style, three backbone skins and a boss, and the
one screen where a level is actually chosen showed forty small cards in a flat
3-wide run separated only by a background TINT — so picking a world to farm
stars in was a scroll-and-squint, and the identity the game spends the most art
on was invisible exactly where it would help. A heading now appears wherever the
world CHANGES, derived end to end: the boundary from the levels' own `world`
field, the name from `DATA.WORLDS[w].label`, the count from the SELECTED star
ladder — so an eleventh world needs no code here and no test edit, the same law
that keeps the card count itself off a literal. The `⭐ 7/12` half is the
actionable one (stars are spendable power, so it says where there are still some
to earn) and it is per-ladder, which a mutation pins: seeding NORMAL and reading
the heading on HARD must show zero, or the count is lying on two of three
ladders. The heading is deliberately not a control — a `div`, `pointer-events:
none`, unfocusable — so no ≥44px law applies to it, and it uses grid `gap`,
which unlike flex gap survives the iOS 14.0 floor. This grid has broken a layout
twice (it once pushed every fort dialog below the fold, and later broke the
contrast audit's opened-proof), so overflow is MEASURED at 320 and 390 rather
than assumed; both old breakages are structurally fixed now (`position: fixed`
overlays, and an audit that counts runs inside `.td-overlay`).
**The mutation lesson: a NEIGHBOUR check is not a POSITION check.** The first
clause read *"the heading must be immediately followed by a card of that world"*
and PASSED the mutation that appends the heading AFTER its world's first card —
because the thing following a misplaced heading is still that world's second
card. Only "the heading sits one slot before the world's FIRST card" can fail
it. Same family as the inequality-is-not-a-magnitude finding: a weaker form of
the claim is often satisfied by the very defect it was written for, and the way
to find out is to run the mutation rather than to admire the assertion.

**THE PAUSE MENU'S TWO DESTRUCTIVE BUTTONS HAD OPPOSITE POLICIES.** 🏰 Back to
the fort has routed through `UI.confirm` since the fort's first UX pass — the
recorded law that *a progress-losing exit must confirm first*, with ↩ Keep
playing prominent and the battle paused while you decide — and 🔁 **Restart
level, the row DIRECTLY BELOW ▶ Resume**, tore the board down on one tap with no
undo. That is the button you press most, one row above the one that destroys
your run. Restarting is if anything the worse of the two: leaving at least keeps
the last wave-boundary checkpoint, restarting keeps nothing. Two adjacent
siblings disagreeing about one rule is this project's most repeated tell
(`hurriedMult`'s two writers, the wake lock's drifted acquire and release,
`writeMidRun`'s three fields with two policies, `resumeMidRun` coercing its array
and trusting its numbers) — so the fix is not a second confirm but ONE owner:
`promptLeave` became `promptDiscard(onGo, copy)`, the old name is GONE rather
than left beside it as a second path, and the two call sites pass their own copy
(a restart dialog that says *"Leave the battle?"* tells the player the wrong
thing, which a mutation pins). **The structural half derives its own list**: it
does not name restart and quit, it takes every handler in `showPauseMenu` that
restarts the level or navigates away and requires it to route through the owner,
so a third destructive action inherits the rule instead of needing this test
edited — with a floor assertion, because that scan fails OPEN. And `UI.confirm(`
must appear exactly once in `td-main`, which is what stops a future inline
dialog quietly reintroducing a second policy.

**A RUN'S LABEL NAMED ITS LEVEL AND NOT ITS RULES — and extending it found that
the difficulty's player-facing NAME had no owner.** The pause menu and the
resume banner share one label, so deciding whether to pick a parked run back up
without knowing which ladder it is on, or that you armed ⛺ Camp's Closed, was a
decision made blind. Adding that meant naming the difficulties in a second
place — and the first copy was a literal `[["casual","😌 Easy"], …]` inside
`renderLevelGrid`, which is both the "a list that outlives its contents" shape
(Kid Fort's removal is the precedent: a mode and its button must not be able to
disagree) and the start of two owners for one string. So `DIFFICULTIES[d]` now
declares its own `label`, exactly like `WORLDS[].label`, `TARGETING[].name` and
`CHIPS[].name`; the chip row DERIVES from `Object.keys(DIFFICULTIES)` and is
proven self-provingly (inject a fourth tier at runtime and the row must grow —
the build-menu fifth-line pattern); and one accessor reads the name, with a
fallback to the id so a label-less tier degrades rather than rendering
`undefined`. The one-owner scan takes its NEEDLES FROM THE DATA — for every
declared label, no other source file may contain that string — so a fourth tier
is covered without editing the test.
**The clause that matters most is the checkpoint one, and its mutation shows the
bug in words**: the label reads the RUN's own `state.difficulty`/`state.chips`
(and the checkpoint's own copies), never the save, so switching ladder or
disarming a chip while a run is parked cannot retroactively relabel it. Point it
at the save instead and the banner reads `Level 1 · Under the Bed · 😌 Easy`
for a run that is on heroic — the same checkpoint-fidelity class already
recorded for `writeMidRun`'s `meta: activeLoadout()`, and the reason those three
sibling fields are read off the run.

**THE META ROW SAID NOTHING ABOUT WHAT YOU HAD ARMED.** ⭐ Star Tree has badged
unspent stars since the QoL pass began, justified because an unspent star is
literally unused power; the other six buttons were bare, and two of them carry
state a player acts on. A 🎖️ challenge chip is armed BEFORE a run and changes
that run's rules, so arming one and forgetting it means entering a level under a
constraint you cannot see — the run LABEL now names it once you are inside (the
entry above), and the fort home is where you would actually fix it. And 📅 the
Daily is one puzzle per calendar day, so "today's is unplayed" is the entire
reason to open that button, and it clears once today's score is recorded rather
than nagging. Both go through the ONE `renderMetaCounts` owner, which grew a
`mark()` helper rather than a second badge path.
**The interesting half is what is deliberately NOT badged, and why that is
written into the code**: 🎒 Powers is always slots-of-slots (`activePowers`
never leaves a pack under-filled), 🏅 Badges are earned rather than spent, and
♾️ Endless / 📖 Guide carry no per-visit state — so a badge there would be
decoration, which this project has already deleted twice for being
unfalsifiable, and the test asserts those four stay BARE so a future author
cannot quietly complete the set. Two smaller rules held: the date rule that
decides *which* daily this is keeps its single owner in `dayKey` and is
INJECTED into the UI (`UI.today`) rather than re-derived, and the chip count
resolves ids through `DATA.CHIPS` so a retired chip drops out — both
mutation-proven, the second by a `__retired` id in the fixture that must not be
counted.

**THE NEXT-WAVE PREVIEW HID EXACTLY WHEN THE DECISION IT INFORMS IS MADE.** It
was gated on `state.phase === "build"` — correct when the only way to send a
wave was ▶ CALL. TD-15 then made CALL work mid-wave as ⏩ RUSH, which drops the
NEXT wave on top of the one already walking for the same early-call gold, and
the preview was never revisited: so the one decision whose entire cost/benefit
is *what is in the next wave* was made with the thing that says so switched off.
Third instance of the law that shipped the ⬆ upgrade preview and the `% road`
figure — the information belongs at the moment of the decision — and a sibling
of the side-door defect, where a marker that appeared only once the wave was in
flight lit up after the gold was already committed. The rule is deliberately
tighter than "always show": the pill is up during BUILD, and mid-wave only while
RUSH is actually on offer, reading `ok` off the SAME `callInfo` the button
reads, so the two can never disagree and it disappears again when RUSH is
refused (steady… / N waves out / last wave) instead of becoming permanent
furniture over the spawn end of the field. Three mutations, and the sharpest is
the one that points the preview at `waveIdx` instead of `sentIdx`: it then
describes the wave already WALKING, which looks completely plausible on screen
and is exactly backwards — `waveIdx` is what has been CLEARED and `sentIdx` what
has been SENT, and only the second is what a RUSH tap would add.

**LOSING A HARD RUN AND TAPPING RETRY COULD HAND YOU AN EASY ONE — reproduced,
then fixed.** `startLevel` resolves `opts.difficulty || save.difficulty`, and the
defeat screen's Retry passed only a seed, so it silently inherited whatever the
fort home was set to *now*. The path is one a player walks: park a heroic run,
switch the chip to 😌 Easy, resume (the checkpoint correctly restores heroic),
lose — and the probe printed `AFTER RETRY difficulty: casual`. A win there writes
a CASUAL star for what the screen had just called Hard. Three siblings with two
policies, again: `restart` and ▶ Next carried `st.difficulty` (and restart's own
comment explains why it must), Retry carried nothing — and **none of the four
carried the CHIPS**, so a resumed challenge run stopped being a challenge on
every one of those paths. Fixed with ONE `continueOpts(st)`, and the line drawn
deliberately: difficulty and chips are carried because they cannot be changed
from the play screen and they decide how a win is SCORED, while `meta`/`powers`
are a fort-home loadout that every start re-reads including the first, so
carrying them would lock a resumed run's pack in with no way to change it. The
endless retry was included for the same reason its scoreboard demands it —
`endlessBest` is not keyed by difficulty, so a silent switch mid-session puts two
different games on one board.
**The structural half is the interesting one, because the honest derivation was
not available.** "Which code can see a live run" cannot be read off the text —
my first attempt split the file on handler names and immediately false-positived
on a confirm dialog's `onNo`, which had merely swallowed a following chunk. So
the two regions are NAMED (`phaseWatch`, `showPauseMenu`), each asserted to
exist so a rename cannot make the check vacuous, and the property inside them is
a COUNT: the number of `startLevel`/`startEndless` calls must equal the number
of `continueOpts` references, which catches a fifth outcome button without
editing the test. `startDaily` is deliberately uncounted — a daily's rules come
from the calendar, so re-deriving them is correct. When a derivation would need
a heuristic, prefer a named scope with a derived PROPERTY over a clever scan
that is wrong on its first run.

**SHIPPING TWELVE UI CHANGES WITHOUT LOOKING AT A PIXEL, THEN LOOKING — and the
screenshot found a regression I had introduced an hour earlier.** Keeping the
next-wave pill up through a wave (so ⏩ RUSH can be read) also keeps it OVER the
field, and measured across all 40 maps the fixed top-CENTRE anchor lands on a
lane's first cells on **10 of them**. That was harmless while it only showed
during BUILD — an empty road — and is a real cost with bodies walking underneath
it: a control that cannot steal a tap can still hide the thing you are deciding
about. The pill now picks whichever of left / centre / right keeps the most
distance from every lane point in its own horizontal band, which takes 390px
from **10 → 1** (L7's lane spans the whole band at that height, so it keeps the
centre and is never WORSE than what it replaced).
**"A viewport list IS the test", again, and this time it halved the result.** The
same derived anchor clears only 28 of 40 at **320px**, because there the pill is
~47% of the canvas width and left/right barely differ from centre — there is
nowhere to dodge TO. A narrow-width font shrink gives it room and takes 320 to
7 of 40; landscape reads 1 and an iPad 0. All four numbers are pinned rather
than fenced, at the values actually measured.
**And the probe disagreeing with its own prediction found a real staleness
bug.** The recompute was keyed on the pill's TEXT, so two levels whose wave-1
preview reads identically leave the previous level's corner in place — and there
are **7 such pairs among the 40**. It keys on level + canvas width + text now,
which also covers a rotation, since that moves every lane without changing a
character. The test isolates it with L39 and L40: byte-identical previews,
opposite clear corners, so a text-only key visibly leaves L40 wearing L39's
anchor. That clause had to be moved to the FRONT of the test — the population
walk is affected by staleness too, so it fired first and the pair clause was
still unproven, the earlier-clause trap for the fourth time in this stretch.

**THE SAME SCREENSHOT PASS FOUND TWO MORE, AND THE FIRST IS A LESSON THIS FILE
ALREADY CONTAINS.** (1) **The ⭐ count badge sat ON its own label at every width
measured** — 53px² at 390, 79px² at 768/834/1024 where the button's text wraps to
two lines. Its own test had measured that button heights stayed byte-identical
and that nothing overflowed, which is exactly the shape of the recorded level-card
finding: *"a first cut put it in an absolutely positioned corner, which measured
free and then COLLIDED with the level number"*. Committed again one screen over,
by the person who wrote that sentence down. The cards solved it by sharing a flex
row (a flex row cannot overlap); a corner badge can keep its corner only if the
space is RESERVED, so a badged button gets `padding-right: 24px` — and **24 is the
measured floor, not a round number**: at 20 the narrowest button still overlaps by
5-7px², which its own mutation reports. (2) **The 40-card grid orphaned one card
per world.** Every world is four levels (a boss headlines each world's fourth,
which `TD structure` pins), so a 3-wide grid always leaves a ragged half-row —
ten of them — while costing the SAME number of rows as 2-wide. Measured, two
columns is strictly better: the grid is **131px shorter at 390 and 198px at
320**, and level names wrapping to two lines go **32 of 40 → 0**, because the
cards are half as many and half again as wide; the tablet is unchanged in height
with wider cards. The structural clause is `levelsPerWorld % columns === 0`,
derived from the data and the computed column count, so it generalises to an
eleventh world of a different size; the no-wrap clause is the player-visible
payoff and is proven independently (a `max-width` on the card, keeping two
columns, turns only it red). **And the change broke one of my own clauses from an
hour earlier**: the world heading was asserted to be wider than `card × 2.5`, a
proxy that happened to hold at three columns and fails at two — it asserts the
grid's own width now, which is the property it always meant.

**LOOKING AT THE DEFEAT SCREEN — which nothing in this session had — found a
button that had escaped its own column, and the mechanism generalises.** The
overlay box is a column flex, so its DIRECT children stretch to its width; the
post-mortem's 📖 button is nested one level down inside the post-mortem block,
so it escaped that and rendered **171px wide and hard left in a column of 272px
siblings**. It does not read as a deliberate secondary control — it reads as a
button that failed to size, and it sits on the screen a player sees every time
they lose. **A flex-item rule is escaped by NESTING**, which is the same family
as the child-combinator traps this file records, so the guardrail is the generic
form rather than a fix for this button: every `.td-btn` stacked in an overlay
column must share a width and a left edge, with `.td-overlay__row` excluded
because those are deliberately side by side. The pause menu is the control that
proves the check is not defeat-specific.
**And the resume banner had become six lines.** Naming the run's RULES made the
label longer, and at 320 the two buttons leave it ~140px of a 296px row — six
lines of two or three words each, on the very text you read to decide whether to
pick the run back up. Wrapping it onto its own row gives it 268px and three
lines, with the buttons at their 44px floor and the banner 5px shorter; 390 and
up are byte-identical. **Two of the five declarations were then measured
redundant and deleted** — the label is the first child, so the row's `* + *`
margin never applied to it, and the mutation that removed them passed. A line
whose removal changes nothing makes its own guardrail unfalsifiable, which is
the third time this file has deleted one for that reason. The honest mutation
for the rest is to remove the whole media block, which reports the original six.

**A BADGE WAS ANNOUNCED BEHIND THE SCREEN IT WAS EARNED ON.** The achievement
toast is deliberately `z-index: 15` — its own comment says it must paint UNDER
the victory/defeat overlay so a landscape toast can never cover those buttons,
which was an earlier audit's call and the right one. But nearly every badge is
earned at the moment of a WIN, when that overlay is up, so the announcement
arrived dimmed behind a 70% scrim and clipped off the bottom of the screen: the
one thing that tells you an achievement happened was systematically hidden at
exactly the moment it fires. Found by SCREENSHOTTING the victory screen, which
nothing in this session had done. **Flipping the z-index would simply trade this
defect for the one already fixed**, so the rule is instead *announce a badge
where it was EARNED*: one `announce()` routes by the engine's phase — an outcome
on screen means the badge is rendered INSIDE that box beside the stars and the
unlock, and a mid-run badge (First Blood, Ice Age) still toasts, because nothing
is covering it then. The 🎖️ challenge-done line had the identical problem and
goes through the same owner.
**Two fixture failures and one unproven clause, all instructive.** The control
("a mid-run badge still toasts") passed vacuously twice: first because
`earnAch` returns early for a badge already owned, so First Blood could never
fire again after the win above it — and then because a neglect run has no
towers, so nothing dies and there is no first kill to have. It needs a fresh
save AND a board. And the mutation that never drains the pending list PASSED,
because the test only ever reached ONE outcome box; the clause that makes the
drain falsifiable is that a LATER box must name only what that outcome earned,
which now reports the defeat screen repeating `Doorman` from the run before it.
**And the gate hung for 93 minutes on a defect that did not exist.** The last
child was `tests/td.test.js` at **5 seconds of CPU in 90 minutes** — the tell is
CPU TIME, not liveness — and run alone the same file passes 147/147 in 138s. The
cause was mine: I had been running browser probes and mutation runs CONCURRENTLY
with the gate, and both drive Chromium while the suite already runs its files in
parallel. Do not run a probe while the gate is up; it is the frame-budget
contention lesson one level higher, and here it cost an hour and a half.

**AND SCREENSHOTTING THE FIX FOUND TWO MORE — one of which NO TEXT ASSERTION
COULD EVER SEE.** The new badge line rendered as **"Badge earned!Doorman"**,
with no space — while `textContent` reported `"🚪Badge earned! Doorman"`, space
and all. The cause is that the line is a **flex container**, which turns each
child into an ITEM and trims the whitespace at their boundaries, so a bare text
node beside the `<b>` loses its leading space in LAYOUT while remaining in the
DOM. Wrapping the message in its own span makes it one item and the space
survives. Two things generalise: **a flex container silently eats the space
between an inline element and an adjacent text node**, and the only way to catch
it is the PICTURE or the geometry — every text-based assertion passes. The
metric took two attempts, too: a Range over the whole text node INCLUDES the
leading space, so its left edge is flush with `</b>` whether or not the space
renders and the gap reads 0 either way; it has to start after the whitespace.
Second, **a toast still alive when a dialog opens becomes a dimmed ghost**,
because the toast paints under the scrim by design — so `overlay()` now clears
them. Its mutation initially passed, since the existing clauses only checked
that a WIN-time badge was not a toast; the clause that covers it earns a toast
mid-run and then opens the pause menu. That clause hit the documented
`newGame`-leaves-the-run-PAUSED trap (the first ⏸ tap resumes instead of
opening), and it asserts the toast is still alive before opening the dialog, so
it cannot pass by having nothing to clear.

**THE STAR TREE SHOWED YOUR BUDGET AND THEN SCROLLED IT AWAY.** How many stars
you have to spend is the number every one of the tree's 40 nodes is judged
against, and it lived in a big block at the very top of a dialog whose content
is **2900px tall** — so it was gone the moment you began browsing. Worse, it
wore `.td-overlay__stars`, the VICTORY screen's display-size star row, so one
short fact took **68px across two lines**: measured at 320, the header ran to
y=247 of a **488px** box, meaning HALF the dialog was header and **3 of 40**
nodes were visible. Moving it onto the sticky strip that already carries the ✕
fixes both halves at once — the header drops to y=179 (4 nodes at 320, 8 at 390)
and the budget is still on screen after scrolling the whole tree. Fourth instance
of the law that shipped the ⬆ upgrade preview, the `% road` figure and the RUSH
preview: the information belongs where the decision is made. The slot is
generic (`metaOverlay(cls, html, note)`), always rendered so the ✕ keeps its
right edge, and every other dialog simply leaves it empty.
**The mutation that mattered was the one that PASSED.** I justified
`space-between` in a comment by saying `flex-end` would push the ✕ to the left —
and it does not, because the note element is always rendered, so the strip
always has two children and both go right. The comment was wrong and the clause
it implied was untestable. What `space-between` actually buys is the note
sitting at the LEFT edge, reading as a header, instead of crowded against the
close button — so that is what the test now measures (79px in, under flex-end,
against a bar of 8), and the comment says the true thing. **When a mutation
passes, the first thing to check is whether the sentence justifying the code is
even true.**

**THE GAME'S TEACHING SURFACE IS 21 SCREENS LONG AND HAD NO WAY TO JUMP.**
Measured, the 📖 Toybox Guide is **15,490px** tall in a 726px box: reaching the
⭐ Star Tree section meant scrolling 3,342px, and the **56-enemy roster — 77% of
the whole dialog — had no heading of its own at all**, so its longest stretch was
also its least navigable. It now opens with a contents row, DERIVED from the
sections' own `data-sec` labels so a ninth section appears the moment it is
written, and the roster finally gets a heading. Nine entries, every one at the
fort's 44px adult floor, in a wrapping grid that costs **144px at both 390 and
320** — the first cut used a 96px minimum track, which is two columns on the
narrow phone and cost 244px of a 488px box; 72px gives three columns at both.
The jump does its own arithmetic on the BOX rather than calling
`scrollIntoView`, because the box is the scrollport and it has a sticky header
strip — landing under that strip is the same as not landing at all, which is
exactly what its mutation reports (`heading at 0px, strip is 70px`).
**Two lessons from the tests.** The button's index was first stored as
`data-sec`, colliding with the SECTION marker of the same name, so
`[data-sec]` matched eighteen things instead of nine — caught by a derived
clause (`one entry per section`) that a hand-written count would have missed,
and fixed in the product rather than worked around in the test. And the mutation
that removes the roster's heading PASSED at first, because "at least six
entries" and "one per section" are both still true with eight: the clause that
catches it has to name the property — the roster list must be introduced by a
section — rather than count entries a shorter guide would also satisfy.

**THE FORT GAVE A TABLET MORE, NARROWER BUTTONS THAN A PHONE — the "more tiles,
not bigger" defect, on a screen it had never been checked on.** Measured across
six widths, the fort home's meta row went **117px at 390 → 109 at 600 → 93 at
768, 834 and 1024**: a wider screen handed you a NARROWER control, every label
wrapped to two lines, because `auto-fit` at a 92px minimum simply packed all
seven across. Josh's launcher had exactly this and was fixed; the fort's own
meta row never was. A 150px track above 600px gives **4 across at 168px with
every label on one line**; 170px was measured and buys nothing but a third row.
**The law had to be weaker than the obvious one, and that is the interesting
part.** Strict monotonicity is false even after the fix — a wrapping grid STEPS
when it gains a column, so the row really does go 187px at 600 → 168 at 768 —
and that is inherent, not a defect. The property that was actually false, and
is now asserted across every fort-home control, is that **a TABLET must never
be stingier than a PHONE**. Its mutation reports the shipped number exactly
(`93px — NARROWER than the 117px it gets on a 390px phone`). The no-wrap clause
beside it is the payoff rather than a tight pin — a 120px track also clears it —
and the test says so instead of implying 150 is a measured floor.
Same commit, same lesson one dialog over: the guide's contents row was
`auto-fit`, which at 390 is four columns for nine entries — **4+4+1**, a ragged
last row for the same number of rows that 3+3+3 fills evenly. When the item
count is FIXED and small, an even grid beats a dense one; the clause is
`entries % columns === 0`, which is the level grid's orphan law generalised.

**A VIEWPORT WAS ADDED TO A TEST, MEASURED CLEAN, AND COULD NOT FAIL — and the
fix was a different SIZE, not a different threshold.** The next-wave pill's
anchor test pins 390 (budget 1) and 320 (budget 7); a landscape clause was added
at 844x390, measured 1 of 40, and the isolation run came back `ok`. Measuring the
DEFECT rather than the fix says why: fixed-centre vs anchored is **10 vs 1** at
390 portrait, **16 vs 7** at 320, **5 vs 1** at 667x375 — and **0 vs 0** at both
844x390 and 1024x768. In a wide landscape the pill is a small fraction of the
canvas and the centre already misses every lane, so no budget at that size can
separate the two states. Re-pointed at 667x375, where the mutation reads
`5 maps ... budget of 1 (L14, L19, L20, L26, L31)`. **This is the second half of
"a viewport list IS the test": a size earns its place only if it can SEPARATE the
two states, and the only way to know is to measure the defect AT that size.** It
is the same conclusion the fort-overlay audit reached when it declined to add
tablet portrait — but there the reasoning was structural (a roomy viewport cannot
catch an overflow), and here nothing but the measurement would have said so. The
two dead sizes are named in the test comment rather than silently omitted, so the
next author does not "improve" it by adding them back.

**THE THREE DIFFICULTY LADDERS WERE INVISIBLE, so switching to Hard read as data
loss.** Stars, locks and unlocks have been per-difficulty since a 2026-07 user
request, and nothing anywhere said so: measured on a save with 24 levels beaten
on Normal, tapping the Hard chip takes the grid from **25 playable cards to 1**,
and the fort home's entire text mentions no ladder, no separate progress, nothing
— so the single most alarming thing the fort can do to a player had no
explanation on screen. Each chip now carries its own ladder's progress
(`24/40` under Normal while you stand on Hard's `0/40`), which makes the collapse
self-explanatory at the moment it happens. Six things worth keeping. (1) **The
count and the grid are the same question asked twice**, so "beaten" has ONE
definition — `>= 1` star on that ladder — that both `ladderBeaten` and the grid's
unlock rule read; a chip advertising a number the grid then contradicts is worse
than no number. (2) **The strongest clause is therefore an IDENTITY, not a
value**: on a contiguous ladder the cards the grid opens must equal the beaten
count plus L1, and the mutation that re-derives the unlock threshold inline fires
exactly it. (3) **A fixture clause asserting the same number as a real clause
SWALLOWS the mutation aimed at the real one** — the first cut had
`assert.equal(s.playable, 25, "fixture: ...")` above the identity clause, so the
mutation reported a fixture failure and the identity clause stayed unproven; the
duplicate is deleted and the test says why. (4) **A mutation of the SHARED
predicate fires the grid clause rather than the count clause, which is evidence
the extraction is real** — isolating the count needs a mutation inside
`ladderBeaten` alone. (5) **Deliberately ALWAYS shown, unlike the meta row's
badges**, whose rule is that a badge appearing only when there is something to
act on is a signal while an ever-present one is decoration: here the message IS
the comparison between three numbers, so hiding a zero destroys it, and on a
fresh save three `0/40`s teach the split at once. The difference is stated in
the code rather than left as an inconsistency. (6) **A two-line button's
`textContent` concatenates** (`"⚔️ Normal24/40"`), so the accessible name is set
explicitly, and the existing self-proving test that asserted a chip's whole
`textContent` equalled its declared tier name now reads the label TEXT NODE —
its claim was about the NAME, not about everything printed on the control.
Measured cost: the chip goes 46 -> 52px (adult floor 44), the count is contained
inside its chip and the page does not scroll sideways at 320 / 390 / 834 or in
landscape, and contrast is 9.92:1 selected / 10.88:1 unselected because the line
inherits the button's own colour instead of taking a dim — `#ffd94a` has no
headroom to spend, the law this project has now applied on four surfaces.

**THE BUILD PHASE HAD A COUNTDOWN AND THE WAVE PHASE HAD NOTHING — so the
most-asked in-wave question was unanswerable, and the fix exposed a reflow that
had already shipped.** "Am I nearly through this, or do I hold my gold?" is the
exact bet ⏩ RUSH is against, and the fort said nothing at all once a wave was
walking. The count is now on the RUSH button's own meta line. Five things worth
keeping. (1) **It is the ENGINE's own wave-end quantity, not a second count** —
`finishIfWaveDone` has always tested `spawnQueue.length || enemies.some(alive)`,
and that expression is now `bodiesLeft()`, which the readout also reads, so a
button saying "0 left" while the wave grinds on is not a state this engine can
reach. (2) **Most of a fresh wave is QUEUED, not on screen**, and the spawn queue
is deliberately module-local (a mid-wave position is never checkpointed), so a
readout built from `state.enemies` — the obvious implementation — understates
every wave at exactly the moment you look: measured, the instant a wave is called
it owes 6 bodies and 0 have spawned. That is the clause the test leads with, and
it is what a UI-side recount fails. (3) **The line was chosen because it already
carries a "·"-joined PAIR during build** (bonus · seconds), so no new element and
none of the HUD reflow risk that once had the ⚙️ hopping between rows. (4) **But
the longest pair WRAPS, and reserving for it found a jump that already shipped**:
in landscape `last wave` is one line at 48px and `2 waves out` is two at 53px, so
the button has been changing height on its own wording all along. The reservation
is set to the measured worst case (57px portrait, 65px landscape) and the
guardrail is that the button's height is IDENTICAL across every string it can
render — which pins the old defect as well as the new one. (5) **The reservation
costs the battlefield ZERO** — measured, the canvas is byte-identical at 320, 390,
834 and landscape, because the field is WIDTH-limited in portrait, which is the
same property the portrait pass exploited when it took the side padding back.
Two testing notes. **A synthetic "longer than anything" string is not an upper
bound, it is an arbitrary monster** — my first cut used a 68-character sentence,
which takes four lines and would have demanded a reservation nothing needs; the
bound is DERIVED from the widest each half can be (the longest refusal wording,
with its cap read off `maxWavesInFlight`, plus the largest body count a deep
endless run could reach), which is what makes the string list not-a-list. And
**a fixture clause that reads the thing under test is not a fixture clause** —
"a called wave owes the player bodies" reads the engine's own count on purpose,
so an engine that forgot the queue fails there; labelling it `fixture:` made a
real product failure read as a broken test, so it is worded as the property.

**A ⭐8 CAPSTONE'S ONLY MOMENT WAS PRESENTED AS A LOSS.** 🌟 Sticker Shield's
entire effect is that the first leak each run costs 0 lives — and the engine
emits `{type:"leak", shielded:true}` with no `lives` field and returns before
touching the counter, while BOTH dispatchers played the ordinary leak: the same
descending 330→262 cue and the same full-screen red wash. So the rescue looked
exactly like losing stickers except the number did not move, which reads as a
bug rather than as a save. Measured headless: 20 → 15 with the node against
20 → 14 without it. The tell was this file's most reliable one — **two adjacent
lines disagreeing**: the renderer's toll label already checked `shielded` and
nothing else in either file did. Four things worth keeping. (1) **The fix is a
question of GRAMMAR, not colour** — a save costs nothing, so it does not paint
the "you lost stickers" wash at all; it floats `🌟 SAVED` at the door through
the `toll` fx that already existed, and the cue is the OPPOSITE SHAPE (rising
784/1047/1319 against the leak's fall). (2) **`cur.leaked` and the post-mortem
count deliberately do NOT change** — the body genuinely got past you, and 🛡️ No
Leaks staying honest about that is a documented choice. (3) **The CONTROL had to
be a second RUN, not a second leak** — the 🌟 label lives 34 draws and every body
on L1 reaches the door within about 9, so a same-run control measures a label
that is merely still floating; the first cut failed for exactly that reason and
it was the FIXTURE, not the product. (4) **A `setTimeout(…, 0)` first note is
still a tick late**: the save cue's opening note was deferred like its other two,
so the spy saw zero tones at the leak frame while the leak cue — which plays its
first note synchronously — saw one. Matching the leak's shape is both the fix
and better feedback. The wash bar is a MEASURED separation rather than a slack
(corner warmth 10 on the bare floor, 49 under the wash, and the mutation that
re-adds the wash to a save collapses it to 49 vs 49, so the bar sits at 20).

**DIFFING THE ENGINE'S EMIT LIST AGAINST BOTH DISPATCHERS FOUND THE TWO EVENTS
NOBODY LISTENED TO — and the guardrail for it was a false negative on its first
run.** The event stream is the seam between a deterministic simulation and
everything the player can hear or see, so a type with no consumer is a moment
that silently does not exist. Two of 25 had none: **`buycharge`** — 450 gold
spent in total silence while build, upgrade, sell and a tier-4 branch all ring —
and **`endless-wave`**, the one number that mode is about, revealed only on the
defeat screen after the run was already over. Both now have consumers: a bright
two-note purchase cue, and a 🏆 banner the moment an endless run passes the
world's previous record. Five things worth keeping. (1) **The milestone fires
ONCE per run and only when there IS a record** — a first visit has nothing to
say and a banner on every wave after the record is furniture, which is the same
signal-not-decoration rule the meta-row badges follow. (2) **The record is
captured ON THE RUN at start**, not read from the save each time, and those
genuinely diverge: `persist()` folds `endlessBest` in as a MONOTONIC max, so a
second tab finishing a better run raises this tab's in-memory save mid-run and a
live read would silently SUPPRESS an announcement for a record you really did
pass. (3) **That clause did not exist until a mutation passed** — swapping the
captured record for a live save read changed nothing, because the test never
made the two disagree; the clause that catches it writes the other tab's score to
storage BEFORE a wave boundary merges it. (4) **The scan's first predicate was a
whole-file substring and was satisfied by a coincidence**: deleting the
`buycharge` dispatch branch left it GREEN because the string still appeared in
the sfx table as a CUE NAME — the same trap as the precache check matching a path
inside a comment. It matches `e.type === "x"` now, which immediately surfaced a
third case worth naming rather than hiding: **`lever`'s cue fires at the TAP
site, synchronously**, which is better than a round trip through the event queue,
so it joins `won`/`lost` on an exemption list where every entry carries its
reason. (5) **A structural scan proves a call site exists; only driving it proves
the call does anything** — `sfx("buycharge")` with no matching entry in the cue
table falls straight through the if/else chain and plays nothing, and the scan
cannot see that, so the purchase is driven through the real ⚙️ button. Its
fixture taught two things: read the button's `disabled` BEFORE the tap (buying
fills the bank and correctly disables it), and the cue rides the EVENT, so it
plays when events are DRAINED — the frame loop does that within a frame in real
play, and `newGame` leaves the run paused, so the harness must tick once. A
banner spy also has to be re-installed after every `page.reload()`: a spy that is
quietly gone reads exactly like a feature that quietly stopped firing.

**THE OTHER ARMED, AIMED CONTROL NEVER GOT THE TREATMENT ABILITIES DID — and
the guardrail written for it passed its own mutations THREE TIMES, each for a
different reason.** Enumerating every refusal the engine can return and asking
which ones the player is told about found `rally() → "range"`: arming ⛺ Rally
and tapping a spot beyond the camp's 3.05-cell reach was COMPLETELY silent — no
cue, no reason, the arm consumed, and `setSelection(null)`, which erases the
camp's reach RING, i.e. the one guide you would have aimed by. So a tap a few
pixels out evaporated the whole interaction and you had to reopen the panel.
Abilities were given exactly this treatment (a deny cue plus a reason on the
shared hint line) twenty lines up **in the same handler**, which is this file's
most reliable tell one more time. The fix keeps the arm AND the selection, so a
near miss is correctable rather than a restart. Note what did NOT need building:
selecting a camp already draws its `rallyRange` ring, so the preventive half
shipped years ago and only the recovery half was missing — worth checking before
designing a new affordance. **The three failed guardrail attempts are the real
lesson, and all three are recorded traps.** (1) A GLOBAL count ("at least one
deny cue per armed control") is satisfied by a NEIGHBOUR — the lever's own deny
lives in the same handler — so stripping rally's refusal bare left it green; the
weaker form of a claim is routinely satisfied by the very defect it was written
for. (2) Slicing per branch did not help either, because the region itself was
wrong: `fieldTap` is the LAST function at its indent, so `indexOf("\n  function ")`
returned **-1** and `slice(at, -1)` handed back the rest of the FILE — 21436
chars posing as a 10432-char region, with the last branch borrowing a cue from
hundreds of lines away. A region bound must be asserted to BE a region. (3) With
both fixed, the hint clause still passed, because every one of these branches
calls `UI.abilityHint("")` on its SUCCESS path to clear a stale message — so
finding the call proves nothing about the refusal. It requires a NON-EMPTY
argument now, and the comment says plainly that what the refusal actually SAYS is
pinned behaviourally next door: a scan proves a call site exists, only driving it
proves the call does anything. The behavioural test uses no test-only hook at
all — the engine's own `rallyX/rallyY` proves the flag moved, the corrected tap
landing proves the arm survived, and the ring is asserted as INK, because a hook
would happily report the selection while the picture stopped being drawn.

**THE LOUDEST CONTROL ON THE FORT HOME WAS THE ONE THAT LEAVES IT — because it
was wearing JOSH'S KID CHROME.** A screenshot pass over the fort's screens found
the home's 🏠 exit rendering **76x76 in near-white on a dark-navy screen**, above
the title and larger than every other control there, while the identical 🏠 on
the play screen renders **54x54**. The cause is one missing class: both carry
`btn-round`, which lives in Josh's stylesheet and is sized by the **76px `--tap`
kid token**, and only the play screen's also carries `.td-mini` — whose own
comment says *"adult-sized (>=44) — the fort is Jon's space"*. So the same
button, doing the same job, had two sizes, and the fort was inheriting a size
whose whole justification (a four-year-old's finger) does not apply to it. Fixed
by adding the class; measured, that pulls **22px at 390 and 30px at 320** of the
level grid above the fold (at 320 `.td-mini`'s narrow-phone override gives 46px,
still over the adult floor). Two notes. **A "the exit is not the loudest control"
clause was written and then DELETED as unfalsifiable**: measured against every
button on the fort home it cannot fail, because the 40 level CARDS are buttons
too and are legitimately ~90px tall, so a 76px disc sails under the bar — and
narrowing it to a named list of chrome selectors would fire on the very same
mutation as the size clause, which is a near-duplicate rather than coverage. The
size claim IS the property; the hierarchy was only its motivation. **And the test
NAME still promised the deleted clause**, which is the one kind of documentation
that cannot go red — renamed to what it asserts.

**A RECORDED NON-CHANGE from the same pass, so nobody "fixes" it into a
regression:** the ⭐ Star Tree label wraps to two lines **only when its unspent-star
badge is present** (measured 1 line → 2), which the badge's `padding-right: 24px`
causes. It is left alone, because the button's HEIGHT is 55px either way — zero
layout cost, since 🎖️ Challenges already wraps at this width with no badge at
all — while both available fixes are worse than the wrap: shortening the label to
"⭐ Stars" makes a second owner of a feature name the dialog title also uses, and
24px is the MEASURED floor below which the badge overlaps its own label (at 20 the
narrowest button overlaps by 5-7px²). A cosmetic wrap that costs no pixels is not
worth breaching a measured floor for.

**THE ONE TARGETING MODE YOU HAVE TO BUY WENT BACK TO CALLING ITSELF "cheap" THE
MOMENT YOU SELECTED IT.** This file already records the defect and its fix — the
🎯 button printed the engine's id, so the mode granted by 🔻 Weak Spot read
"cheap" while the node promised "Weakest" — and the fix reached the panel's
INITIAL render only. Eighty lines below it in the same file, the cycle handler
still did `textContent = "🎯 " + nextMode`, the raw id. So the label was correct
until you tapped the button, and then wrong: two owners of one string,
disagreeing on **exactly the one string that matters**, because `cheap → "weakest"`
is the only entry in `DATA.TARGETING` whose name differs from its id — every
other mode hid the bug perfectly. Found by SCREENSHOTTING a tier-3 tower panel,
not by any test. One `targetName()` owner now serves both sites. Three testing
notes, each a mutation that first PASSED. **A derived test can be blind to the
divergence it exists for**: a tower opens on `first`, whose name equals its id,
so rendering the id at the initial-render site is INDISTINGUISHABLE there — the
clause now puts the tower on the diverging mode before opening the panel. **A
defence-in-depth fallback needs an injected input to be falsifiable**: nothing in
shipped data lacks a name, so the `|| mode` fallback is proven by deleting one at
runtime and asserting the button never renders the string `"undefined"`. And
**an unbounded cycle-until-you-see-it does not fail, it HANGS** — with the
fallback mutated away the label stops containing the id, and the test spun until
it was killed. That is this file's own `while` hazard, written into a TEST; bound
every cycle-until loop and assert the guard did not trip, so the failure names
the cause instead of reporting whatever mode it happened to stop on.

**AND THE SNAPSHOT ROLLBACK ATE A COMMITTED CHANGE, which sharpens a rule this
file already carries.** The recorded version says staging work in the scratchpad
is not staging it anywhere, because the repo and `/tmp` die together. The commit
above was **committed to `main` locally** and was still lost: the container
reprovisioned while its gate was running, the clone came back at an older
snapshot, and `.claude/resync-main.sh` correctly fast-forwarded to `origin/main`
reporting "no local work existed to lose" — which was true of the RESTORED clone
and not of the work. **A local commit is not durable on this runner; only a PUSH
is.** Two consequences worth acting on. The window between "gate green" and
"pushed" is the exposure, so push the moment it is green rather than batching a
report first. And when a session resumes, the hook's message tells you the clone
was healed, NOT that nothing was lost — check `git log` for the commits you
believe you made, exactly as the "git says clean is not evidence your work is
present" rule already demands for uncommitted files.

**A FULL POWERS PACK REFUSED THE 48px BUTTON AND NOT THE 255px CARD BESIDE IT.**
The pack holds `RULES.abilitySlots` out of a larger pool, so an un-packed power
at capacity must be refused — and it was, on the ＋ button only. The whole ROW is
`data-power` and is the target a player actually aims at (measured **255px
against the ＋'s 48**), and it stayed enabled, so tapping the obvious thing did
nothing at all and said nothing about why. That is this project's own *"a control
that can't be used says why"* law inverted: the tiny control carried the refusal
and the big one swallowed it, which is the same shape as the recorded Worry Box
bug where a consumed control kept its `[data-toy]` — an element whose
enabled-ness disagrees with what it does. Both now take the same `refused`
expression, the same `disabled`, and the same reason. Three things kept it
honest. **A PACKED row deliberately stays enabled at capacity** — the star tree's
own comment already says a full rack must still let you un-equip "or the last
slot would be a trap" — and the mutation that disables it too goes red on exactly
that clause. **A refused card must LOOK refused**: `.td-node[disabled]` dims to
0.45, and the test asserts it, because a control that looks tappable and is not is
worse than one that is plainly out of reach. And the row/＋ width comparison is a
FIXTURE clause, so if the layout ever made the ＋ the bigger target the test says
so rather than quietly guarding the wrong element.

**And the dead-code scan that found it also found a latent SECOND OWNER of a
player-facing string.** Enumerating `UI.*` exports against every consumer left
two with no caller; one (`UI.paintPrices`) is a harmless one-line export of a
function called internally, and stays on the `cellSize` precedent. The other,
`UI.toast`, formatted `"Badge earned!"` itself and went straight to `UI.notice`
— **bypassing `announce()`, which routes by the run's PHASE** (into the outcome
box when one is on screen, as a toast otherwise) precisely because a toast paints
UNDER an overlay scrim and nearly every badge is earned at a win. Nothing called
it, and that is worse rather than better: it is the name a future author would
reach for, and reaching for it silently reinstates a fixed defect. Deleted, with
a guardrail that the string has exactly one owner. **A dead export is harmless;
a dead export that duplicates a live decision is a trap** — that is the line
between this and `cellSize`. **And "dead" was measured with a scan whose own
scope was wrong, which the GATE caught rather than the scan**: it counted `UI.x`
references in the app but only `TDUI.x` in the tests, and a shipped guardrail
referred to the wrapper as `UI.toast` inside a REGEX LITERAL — so the export was
load-bearing on a TEST while the scan called it dead, and the full suite went
red on a clause pinning the delegation. The clause was repointed rather than
deleted, because the property it always meant (the badge announcement reaches
the ONE toast implementation instead of growing a second) is still true and
still worth pinning — it just lives in `announce()` now. Two lessons: a
dead-code scan must search tests with the SAME patterns it searches source, and
when deleting something a test names, expect to re-point that test at the
property rather than to drop it.

**A RED `verify-live` STOPPED MEANING "THE DEPLOY IS BROKEN".** Run #365 failed
on `page.goto: Peer failed to perform TLS handshake: Error sending data:
Connection reset by peer` — while its own `test` and `deploy` jobs had BOTH
passed, so the site was live, correct, and serving the commit. The two casualties
were the heaviest live tests in the suite (the ones that walk 240 games at two
viewports, so they make hundreds of navigations against the CDN and are the first
to be hit). That is the same shape as the `playwright install` stall: an external
dependency sitting on the critical path with no retry, where a transient produces
the identical signal to a real failure and quietly devalues it. A navigation is
now retried through ONE owner. Four things worth keeping. (1) **The interesting
clauses are the ones about what must NOT be retried** — a timeout, a 404, an
aborted load or an assertion is a REAL failure, and retrying those would turn a
flake filter into a BUG filter, which is far worse than the flake it fixes; the
transient set is an explicit transport-level pattern and the mutation that
retries everything goes red naming the timeout. (2) **Wrap the BROWSER, not the
call sites** — there are 14 `page.goto`s across four files and six places that
build a page, so a per-site helper is a list someone forgets to join; a page made
from a wrapped browser inherits the retry however it was made, and a mutation
that un-wraps the `newContext` route alone is caught. (3) **Every retry is
announced and the original error is re-thrown unchanged** once the attempts are
spent, so a degrading network is visible and a site that is genuinely down still
fails saying why. (4) **The FIXTURE needed its own hard cap**: the first
boundedness clause could not fail against an unbounded retry, it HUNG — the same
`while` hazard recorded two entries above, now met in the test that was written to
police it. A fake page that throws a distinctive `RUNAWAY` past any sane bound
turns the hang into a named red. **A mutation that hangs has not been proven;
give the fixture a bound so it can fail.**

**THE TOYBOX GUIDE ASKED THE PLAYER TO LEARN 56 ENEMIES WHEN THERE ARE 35 — and
the field that proves it was classified as "presentation" by the very guardrail
that exists to stop a mechanic shipping invisible.** 21 of the roster's 56 cards
are backbone SKINS, and `td-logic.test.js` already asserts every one is
stat-identical to its ancestor ("a skin is a costume, not a balance change") —
so the guide's longest section, 77% of a 15,663px dialog, rendered ten separate
cards all reading `❤️ 34 · 🏃 0.8 · 🪙 5 · Can be hit by: 🎯 💥 ❄️ 🪖 · No tricks`
with **nothing tying them together**. A player who meets 🍬 Loose Sweet on L38
and looks it up learned nothing about the 🔵 Speedy Marble they already know how
to kill. Four things worth keeping. (1) **The guardrail was on the wrong side of
its own question**: `skinOf` sat on `NOT_A_TRAIT`, and that classification WAS
the defect — being a costume is exactly the fact a reader needs told, so it is a
trait like any other mechanic. Moving it into `FIELD_TRAIT` makes the derived
coverage law enforce it, which is why a single mutation now turns TWO tests red.
(2) **Both directions are stated because they answer different questions** — the
skin's card answers *"what is this thing that just killed me"* (the defeat screen
deep-links straight to it) and the ancestor's answers *"how many of these do I
actually have to learn"*, and the reverse relation is not a FIELD, so it is
derived by identity exactly as `homeWorld()` matches a world's backbone. (3) **An
earlier pass had already made this diagnosis and stopped halfway** — the `home`
line's own comment says in as many words that it exists so ten "no tricks" cards
"stop reading as ten copies of the same enemy", and it says WHERE you meet one
while never saying it IS one. When a comment states the problem you are looking
at, read what it actually fixed before assuming it is covered. (4) **FOLDING the
skins was considered and rejected on the lookup case**: dropping their stat block
would regress the defeat screen's diagnosis, which sends you to the SKIN's card
to be told what can reach it. So the change is purely additive and its cost is
measured rather than waved through — the guide grows 15,663 → 16,651px (+6.3%),
and the first draft's longer copy wrapped to +9%, which is the argument for terse
trait text. Ordering matters and is pinned: the line is pushed AFTER the
`!out.length` fallback, or a plain skin silently loses "anything can hit it" —
the mutation that moves it reports exactly that. Six mutations red, including one
proving the CARD's render loop puts it on the page (a structural scan proves
`enemyTraits` emits the line; only opening the guide proves it is rendered).

**Two QoL candidates from the same sweep were REJECTED by measurement, recorded
so nobody re-opens them.** (1) **Naming the tower LINES in the build menu** — the
menu shows icon + role + price + `% road` and the names (`Dart Blaster`, `Block
Mortar`, `Freeze-Pop Fan`, `Army Guys Camp`) appear nowhere, not even in an
aria-label. The premise was that a 🎖️ chip constrains by NAME so the player
cannot link the ban to the card; measured, that is false — with 🥵 Heat Wave armed
the Fan card renders `🧊 OFF FOR THIS CHALLENGE 🎖️`, `disabled`, at 0.72 opacity,
so the ban is already unmistakable on the card itself and a name would be
decoration. (2) **Shrinking the fort's 60px top bar in landscape** — measured, it
costs the field nothing worth having: 844×390 leaves 28px below the canvas and
667×375 leaves 27, so only short landscape is height-limited at all, while
1024×768 leaves 350px (not height-limited, so the bar cannot be what binds it)
and PORTRAIT is width-limited, so the bar is free there already. CLAUDE.md's own
law settles the rest — landscape must keep WORKING but is explicitly not a design
target — so this would buy a few pixels on the one orientation the project
deprioritises.

**THE RESUME BANNER SAID "wave 3" — no total, no lives — AND WIDENING IT FOUND
THAT ITS OWN LAYOUT RULE HAD BEEN TUNED AGAINST ONE FIXTURE'S STRING.** The
banner names the level, the ladder and the chips, and then said how far in with a
bare number: you could not tell a run two waves from its finale from one barely
started, and nothing said whether it was parked on 3 hearts or 20 — which is the
fact that actually decides resume-or-restart, since restarting is one tap away on
the grid. Both numbers were already in the checkpoint. Same law as the ⬆ preview,
the `% road` figure and the star goal, now on its fifth surface.
**The owner first.** `UI.hud` held the only wave formatter — including the
load-bearing `endless || !level` predicate, the thing that stops it throwing every
frame on an id like `"endless-bedroom"` that is not in `DATA.LEVELS` — and the
banner had quietly grown a second, poorer one beside it. One `UI.waveLabel` now
serves both, and the scan that pins it counts the COMPUTATION (`waveIdx + 1`),
not the copy: three other places legitimately format a wave number (the endless
🏆 best, the picker's "Best: wave", the daily's all-time) and they are SCORES, so
a word scan would have been the false-positive machine this project refuses.
**Then the shipped guardrail went red, and it was right to.** `wide.lines <= 3`
at 390 caught the longer label at 4 lines. The interesting part is what measuring
it properly then showed: against the worst realistic label (L36 · The Stamping
Press · 💀 Hard · two chips · wave 12/15 · ❤️ 15) the BASELINE is already 4 lines
at 390 — so that clause was never a property of the product, only of the one
short string its fixture happened to seed (L1, normal, one chip). Sweeping widths
found the real defect underneath: the label's own-row rule shipped at
`max-width: 359px`, justified in a comment as *"byte-identical at 390 and up,
where the label already fits in three"*, and **at 360 — the commonest Android
width — the worst label is SIX lines**, i.e. the exact fragmentation the 320 rule
was written to fix, still live one pixel above its breakpoint. A comment that
justifies a constant can be refuted by later data, and a comment cannot go red.
**The new breakpoint is a measured crossover, not a round number.** Own-row
against shared-row, worst label: 320 3L/3L · 360 3L/6L · 390 3L/4L · 414 3L/4L ·
430 2L/4L · 480 2L/3L · 600+ 2L/2L. So owning the row wins on every phone and
stops winning at exactly 600 — where it would buy no line and cost 46px — which
is the project's existing tablet breakpoint, reused rather than invented. And the
guardrail is re-pointed at what it claims: it seeds the LONGEST level name (derived
from the data) on the hard ladder with two chips, and walks 320 / **360** / 390 /
414. Mutation-proven both ways — restoring `359px` reports *"at 360px … 6 lines"*
and taking the label off its own row reports 11 at 320. **When a layout bound is
justified against a test fixture's string, re-derive the string from the DATA and
re-measure; the bound is usually about the fixture.**

**▶ NEXT LEVEL IS THE ONE ENTRY INTO A LEVEL THAT SKIPS THE FORT HOME, AND IT
NAMED NOTHING — while the line above it announced an unlock that had happened
hours ago.** The fort home is where the ⭐ loadout, the 🎒 powers and the 🎖️
chips are chosen, and where a level card states what the level DOES to you (the
derived trick strip, the 👑). ▶ Next bypasses all of it, so the fastest path into
a level was also the only one that told you nothing about it: straight into a
night level, a fork or a boss finale with no cue to go back and pack 🦉 Night
Owl. It carries the level's number, its name and the SAME derived
`levelGimmicks` strip the card does — icons on the button, WORDS in the
`aria-label`, because an icon strip is opaque to a screen reader. And the
`🔓 Level N unlocked!` line beside it was gated on *"does a next level exist"*,
so replaying a beaten level re-announced its unlock every time; it now reads the
same `UI.levelBeaten` predicate the grid's unlock rule and the difficulty chips'
counts use, captured BEFORE the star write, which is the only moment the question
is answerable. Three readers, one predicate.
**The lesson is in the guardrail, and it took two wrong assertions to find.** The
fold clause first read `box.bottom <= innerHeight` — and a 60px mutation PASSED
(455 → 468 of 480), because `.td-overlay__box` is CENTRED and capped at
`calc(100dvh - 24px)`: as content grows the box recentres, so its bottom is a
quantity the CSS guarantees rather than the property. That is the fort's
`wrapW >= viewport.width` proxy again, one screen over — *when a check asserts X,
assert X.* Measuring the CONTENT against the BOX (`scrollHeight > clientHeight`)
is the real claim and fails at +140px, with the shipped worst case — derived as
the longest label, a 2★ finish so the star-goal line is present, a full run
summary and a badge — needing 425px of a 456px cap. The named label costs +10px
(button 56 → 66, box 439 → 449) in portrait and 0 in landscape. **And a second
clause was DELETED for being unfalsifiable rather than kept as decoration**: the
button is a DIRECT child of a column flex box, so `align-items: stretch`
guarantees its width and a `width: fit-content` mutation changes nothing — the
real risk (a NESTED button escaping the column) already has an owner.

**THE BOSS MUSIC WAS ~10x WEAKER ON 40% OF THE CAMPAIGN, AND THE SCALE'S OWN
COMMENT SAID SO.** `MUSIC.scales.dark` was labelled *"natural minor — the boss
voice"*, and four worlds then adopted `dark` as their ORDINARY key (attic,
garage, sort line, toy works). The tense arrangement does exactly two things —
swap the scale and add a drone — so on those four a boss changed the music by
ONE low sine once per phrase: measured, **4 of 64 steps against a bright world's
43**, on the cue whose entire job is to say *this is serious*, across the whole
back half of the campaign. The comment stated the intent and the data
contradicted it; found by enumerating `DATA.WORLDS`, which was the one config
surface never swept. Four things worth keeping. (1) **The escalation is DATA, not
an `if`** — `MUSIC.tenseOf` maps a mode to the scale it escalates TO, so an
eleventh mode must declare its own, and the law is derived: every mode any world
declares must escalate to a scale that actually DIFFERS. Hard-coding `"dark"`
was the defect. (2) **The scale was chosen by MEASUREMENT, not taste** — on a
dark world, steps of 64 that move: octatonic **40**, phrygian dominant 32,
locrian 25, harmonic minor 16, phrygian 9. Only octatonic matches the cue a
bright world already gets, and it is the scale film scoring reaches for; the
shipped result is 40-43 on all ten worlds against the old 4. (3) **The shipped
music test drove `"party"` — a BRIGHT world — so it could never see this**, the
"a viewport list IS the test" law landing on a WORLD list; the clause is derived
over every world now, with a bar (20) that is a measured separation between the
defect (4) and the fix (40). (4) **The two clauses had to be REORDERED to
isolate**: a data mutation moves the behaviour too, so with the behavioural loop
first it always reported the symptom; the data law goes first, and a
musicStep-only mutation then fires the behavioural one. Same pass: **bedroom and
newhouse both shipped root 196.00**, so two of ten rooms sounded identical while
the distinctness clause's loose `>= 6` floor reported nothing — World 7 takes
246.94 and the clause is `=== worlds.length`. A world's key is one of the few
cues that says which room you are in, which is the same reason the backbone
SKINS exist.

**A LEVEL CARD'S ACCESSIBLE NAME WAS NOT MERELY UNHELPFUL — IT WAS WRONG.** All
40 cards are `<button>`s with no `aria-label`, so each is announced as its
concatenated textContent: `"1🕳️Under the Bed●●●⭐⭐⭐🥵"`. The defect underneath
is that the unearned stars and the unearned difficulty pips are DIM, not absent
— three `⭐` and three `●` are always in the DOM — so **a level you have
2-starred announced "star star star"**, and a 0-star boss finale announced the
same. Exactly the class already fixed on the difficulty chips, whose two lines
concatenated to `"⚔️ Normal24/40"`. Each card now carries an explicit label
("Level 7, The Slip'n'Slide. Mud Patch, Conveyor, Track Switch. difficulty 3 of
3. 2 of 3 stars."), and a locked one states the rule instead of reading "nine,
locked, win eight star". Everything meaningful has to be IN the label, because
an explicit one REPLACES the content for assistive tech — so the tricks, the
boss and the chips are named in words, exactly as ▶ Next names them. Zero layout
cost. **The clause that matters is falsifiable only because of the FIXTURE**: a
save that is 3★ everywhere cannot separate "counts the glyphs" from "counts the
save", so the seed deliberately mixes 3, 2, 1 and 0 and asserts it did
(`new Set(stars).size >= 3`) — the find-the-separating-input rule. Five
mutations red, including the one that hard-codes "3 of 3 stars", which reports
the shipped defect verbatim.
**And the gate then went red on the code COMMENT explaining that defect** —
`a difficulty's player-facing NAME has exactly one owner` scans four files for
any declared label, and it read them RAW while its own sibling clause five lines
below already comment-stripped. So the two halves of one test disagreed, and the
raw half matched its own documentation the moment a comment quoted
`"⚔️ Normal24/40"`. Seventh recorded instance of *a scan must not count its own
documentation*, and committed by the person who has written that sentence six
times. Stripped now — block, line and `<!-- -->`, since `index.html` is in the
list — and proven on BOTH sides, which is what makes it a tightening rather than
a weakening: a second owner in `td-ui.js` code goes red, a second owner in
`index.html` markup goes red, and the identical string inside an HTML comment
stays green. Measured while there: the strip removes 1,790 chars from
`index.html` and every one of them is an HTML comment (zero `//` lines, zero
block comments), so it cannot be eating markup.

**Two candidates from the same screenshot pass were MEASURED and left alone.**
(1) **The level cards' trick icons** looked like the Sparkler's
faintest-body-on-the-field defect — 🕳️ is the only dark glyph in the set, on a
dark navy card. Measured as ink against the card's own background at the card's
own 9.9px: ⚡ 1129px/Δ393, 🌙 1442/Δ396, 🕳️ 1835/Δ160, 🚪 2441/Δ209, ⛱️
2556/Δ360, 👑 2845/Δ361, ➡️ 4341/Δ357, 🔀 4344/Δ445. So the two *small* icons are
the *brightest* and the spread is smooth (160…445) with no separation anywhere —
any bar would be an invented threshold, i.e. the fence this file keeps refusing.
No change. (2) **The difficulty pips SATURATE**: the distribution is
`{1:2, 2:4, 3:34}`, so **34 of 40 levels wear an identical `●●●`** and the
element carries information only for World 1-2. They were authored when the
campaign was 12 levels (bedroom 1,1,2,2 · backyard 2,2,3,3 · toystore 3,3,3,3)
and never re-scaled as it grew to 40 — the "a list that outlives its contents"
class, in DATA rather than in prose. Recorded rather than acted on, because both
available fixes are the owner's call and not a defect fix: retiring a visible
element, or re-authoring 34 levels' ratings on a difficulty judgement this
engine's own threshold-domination findings say does not ramp smoothly. The
measurement is here so the next author starts from it.

**A BADGE PROMISED LESS THAN IT REQUIRED — and it is the 🛡️ No Leaks defect
wearing a different icon, still live because every badge guardrail only ever
asked whether a call site EXISTS.** Auditing all 19 descriptions against their
award sites, 18 check out (every "Beat the X" names the boss its level actually
carries — verified against `DATA.LEVELS`, not assumed) and one does not:
**🌪️ Dyson Denied says "Beat the Vacuum King" while the code is
`levelId === 8 && cur.soldiersLost <= 3`.** So a player who beats L8 having lost
a fourth army guy gets nothing, having been told the requirement was just to
win — and the condition is the badge's whole point, since the Vacuum King's
entire kit is eating soldiers. This file already records the same shape on
`noleaks` ("Win a level with all 20 lives" against a `!leaked` check, wrong in
both directions); this is its sibling, and nothing found it because the two
shipped badge laws check that every declared badge has an `earnAch` call and
that every boss has a badge — neither reads what the call REQUIRES. Fixed the
one-owner way: the bar moves into the DATA beside the words that promise it, the
award site asks `achSoldierCap()`, and the description states the number. Three
mutations red, and the third is the one that generalises: the guardrail's second
half walks EVERY badge and fails on any numeric field its description does not
mention, so a second gated badge inherits the rule — proven by giving
🎯 Pea Purist a `lines: 1` it never says out loud. **When a badge is gated, the
gate is player copy, not an implementation detail.**

**THE 🏅 BADGE GRID SHOWED A PLAYER AT 58 OF 60 STARS EXACTLY WHAT IT SHOWED ONE
AT 3.** Three of the 19 badges have a COUNTABLE target — ⭐ Star Collector,
👑 Full Fort and 🏃 Marathoner — and the overlay rendered only earned-or-locked,
so the two that measure the campaign's whole long game were the two you could
not track. Fifth surface for the law that shipped the ⬆ preview, the `% road`
figure, the star goal and the RUSH preview. Two things keep it honest. **The
DENOMINATORS are the award site's own thresholds** (`round(cap/2)` and `cap`,
derived from `LEVELS.length * 3`), because a literal 60/120 goes stale the
moment an eleventh world lands — the exact defect the star ceiling already
records. And **it renders only while UNEARNED**: once you have the badge the
count is noise, which is the same signal-not-decoration rule the fort-home meta
badges follow. 🏃 Marathoner shows nothing at all until there IS an endless run,
because "0 of 20" before you have opened an arena is a bar, not progress.
Measured cost: the grid grows 990 → 1002px (one description wraps) on a dialog
that already scrolls and has a sticky ✕. No new colour — the count inherits the
description's, so it adds no AA risk to an overlay the contrast audit already
walks, and its class is only the test's handle.
**The lesson is the clause that could not fail.** "An earned badge must not wear
a count" was written against 🚪 Doorman — which is not a countable badge at all,
so `progress[id]` is `undefined` whether or not the earned check exists, and the
mutation that drops the check sailed straight through. Re-pointed at a COUNTABLE
badge seeded as earned, it goes red. Same family as the ratio net that passed its
own mutation and the `bottom <= innerHeight` proxy: **a clause has to be aimed at
an input the defect can actually reach**, and the way to find out is to run the
mutation rather than to admire the assertion. The second seed exists for the
sibling reason — a hard-coded "48/60" satisfies every other clause, so the test
opens the grid twice and requires the number to MOVE.

**THE FORT HOME ENUMERATED THE ROSTER IN PROSE AND NAMED 13 OF 25 SHAPES.** The
blurb under the level grid claimed to describe *"the whole toybox roster"* and
then listed it by hand — *"(splitters, armor, chargers, ghosts, moles, shielded
bots, fliers, soakers, jammers, greased runners, spawners, padding, blaring
stereos)"*. Measured against the trait keys `enemyTraits` actually derives, that
is **13 of 25**: the Junk Healer, the Drip Slime, 🦆's zap resist, 🛢️'s oil,
🎇's death-jam and the Piñata's gold burst all shipped after it was written and
none was added, and no boss kit ever appeared. Tenth instance of a list that
outlives its contents, this time in PLAYER COPY — and a prose list of 25 shapes
is unmaintainable by construction, so the fix is not to extend it. It becomes
two DERIVED numbers plus a pointer at the one surface that does enumerate:
*"35 different toys wearing 56 names, with 24 tricks between them (📖 the Guide
explains every one)"*. The body count is the costume fact the guide learned an
hour earlier, now on the home screen; the tower-line count stopped being a
literal 4 in the same line.
**Two of the four mutations PASSED first, and both for the same reason: a
literal equal to today's value satisfies a clause that only checks the value.**
(1) Hard-coding the whole sentence into the shell survived
`note.includes(UI.rosterBlurb())`, because the hard-coded text IS what the owner
produces today — and the note lives in the screen SHELL, built once, so no
runtime change to the owner can make the DOM follow. That half is unobservable
from a browser and is pinned structurally instead: the note region must contain
`UI.rosterBlurb()` and no standalone digit. (`tier-4` is exempt because a digit
bound into a word by a hyphen is a NAME, not a count — the distinction is the
claim, not a fence.) (2) The trick count survived hard-coding because the
self-proving injection ADDED a body carrying `spill`, a trick the Oil Drum
already has — **every trick the engine knows already has a carrier, so adding
one can never move that number.** It is falsified by REMOVAL instead: derive the
trick with exactly one carrier (14 of the 24 qualify), delete that enemy, and
require the count to fall. **When a self-proving injection cannot move a number,
check whether the quantity is saturated and falsify it from the other side.**

**"WHICH LANES, AND WHICH IS LANE 0" HAD THREE OWNERS, AND THE GUARDRAIL OVER
THEM SILENTLY EXEMPTED 40% OF ITS POPULATION.** Enumerating `DATA.LEVELS` found
`(levelDef.paths && levelDef.paths.length ? levelDef.paths : [levelDef.path])`
written out three times — in `createEngine`, in `laneCoverage` and in
`propCells` — and all three have to agree, because the engine positions every
enemy along lane 0, the `% road` figure measures a pad against it, and the prop
scatter keeps clear of it. A disagreement is not cosmetic: an enemy drawn on the
wrong track is the near-miss TD-7 already records. One `lanesOf()` owner now,
which also drops falsy entries so a level one field short degrades instead of
handing `undefined` to `buildPath` — and that it never HAPPENS is a guardrail's
job, not a runtime throw's (all 40 levels and all 10 arenas resolve lane 0
identically, asserted).
**The sibling finding is the sharper one.** The fork test's default-noop clause —
*"lane 0 is exactly the level's original single path"* — is guarded on
`if (l.path)`, and **four of the ten fork levels (L10, L19, L27, L31) were
authored with `paths` and no `path` at all**, so for them it checks nothing.
That is correct as DATA (they never had a single-lane original) and wrong as a
guardrail, because deleting `path` from a retrofitted level is then a way to
silence its own proof. **The obvious repair does not work**: a bar like
`checkedNoop >= 3` is satisfied by exactly the dodge, since removing one field
takes 6 to 5. It needs a CONSCIOUS exemption list plus an exact count, and the
mutation that proves it is the real thing — rename L3's `path` and it reports
*"fork level(s) 3 declare paths[] with no `path`"*. **A count-based floor is not
a substitute for naming the exemption: the floor tolerates the first step of the
very drift it is guarding.** One more instance of the scan-matches-itself trap
while writing it: the first cut banned the ternary outright and flagged
`lanesOf`'s own body, so it counts occurrences and requires the single survivor
to be inside the owner.

**16 OF THE FORT'S 19 BADGES WORE THE IDENTICAL 🔒 — the Sticker Book's defect,
fixed in Josh's world and never carried across.** This file already records
*"170 of 200 slots were the identical ❓; an unearned slot is now a faint grey
GHOST of the sticker you will win, so the book reads as a collection to fill"* —
and the fort's 🏅 grid, built later, hid every badge's own icon behind a padlock
until it was earned. That is the recurring shape: a fix recorded as a one-off
instead of asked *what else has this?*. An unearned badge now shows its own icon
dimmed, so 🛡️, 🎯, 🧊, 🌪️ and ⚡ are legible from the first visit and the grid
reads as a collection. Three things kept it honest. **OPACITY, never a filter** —
a CSS `filter` on art rendered in bulk is this project's documented WebKit
rasterization cliff (the 200 `grayscale(1)`ed slots that stalled CI for over an
hour), and the guardrail asserts `filter: none` on every badge icon rather than
trusting the comment. **The bar is a SEPARATION, not the shipped 0.3** — a ghost
must be visible (>0.1) and clearly secondary (<0.6x the earned icon), so a
future re-tune inside that band is free and a value outside it is not.
**And dropping the padlock dropped the only thing SAYING "locked"** — a badge
cell has no other state text, so its accessible name would have gone from
"🔒 No Leaks…" to "🛡️ No Leaks…" with the state silently lost. That is the exact
regression the level cards had just been fixed for, one screen over, so the cell
gained an explicit label naming earned-or-locked in the same change. **When you
remove a glyph, check what it was carrying besides decoration.**

**THE TILE-ICON LAW NEVER REACHED THE FORT, AND THE WORST OFFENDER WAS NOT A
DUPLICATE — IT WAS A WRONG PICTURE.** Josh's world audits every screen for two
tiles sharing a glyph (45 of his 240 did); the fort, built later, was never
asked. Measured across its five pickers, badges / chips / powers / tower lines /
worlds are all clean, and **the 40-node star tree had FOUR nodes wearing 🎯** —
of which only two are a rank pair. The genuinely wrong one is 🎯 **Close
Quarters**, whose description is *"The Mortar's dead zone shrinks 40%"*: a
MORTAR skill wearing the DART line's own icon, which is the `cheap`/"Weakest"
class one layer out — not a collision but a picture that says the wrong thing.
Fixed to 🤏; ✨ Steady Aim takes the sparkle the game already uses as its crit
cue; 🥶 Deep Freeze stops impersonating 🧊 Cold Front, a different skill and not
a rank of it; and 🛡️ Padding stops wearing the brick that belongs to the
Mortar's crates. **The law is derived with ONE exemption, and the exemption is
the interesting part**: a rank II node *should* wear its rank I icon — that is
how you see they are one skill — so the pair is legal exactly when `req` links
them, which means a rank III inherits the exemption and a brand-new skill never
does. Three mutations across three different surfaces go red (a tree node
re-taking 🎯, two badges sharing one, two powers sharing one). **When a fix is
recorded in one world, the next question is which other world has the same
surface** — this is the second such carry-over in a row, after the Sticker
Book's ghost.

**THE ENDLESS PICKER LISTED WORLD 6 ABOVE WORLD 5, AND THE TWO ADJACENT LITERALS
THAT DECIDE IT NEED OPPOSITE TREATMENT — which is the part worth keeping.**
Found by SCREENSHOTTING the fort's five meta dialogs, which nothing does: the
picker rendered `Object.keys(ENDLESS.worlds)`, i.e. the order somebody typed a
second literal, and that literal had drifted from the campaign — 📦 Moving Day
declared above 🔧 Garage. On a save partway through the campaign that puts an
UNLOCKED arena BELOW a locked one, on the one screen whose whole job is showing
what is open. The tell was in the file: the two comments above the pair sat
W5-then-W6 over a moving-then-garage pair, so the swap was plainly accidental.
One owner now (`TDLogic.byWorldOrder`, over a `worldOrder()` derived from
`DATA.LEVELS` — the order the player actually meets the worlds), and an unknown
world sorts LAST rather than being dropped, because an arena that exists and
cannot be reached is the exact defect that picker's own comment already records.
**Its sibling `ENDLESS.arenas` must NOT be sorted, and that is not a style
choice**: 📅 the Daily indexes `Object.keys(arenas)` by the date hash, so tidying
those keys re-points EVERY past and future date at a different board and a
stored daily best refers to a board nobody can replay. Two literals in one
object, one whose order must be fixed and one whose order must never move — so
the data says so where the tidy-up would happen, and the pin is **one date per
arena INDEX** (a shorter list tolerates a swap of the keys it does not cover).
Three testing notes. **A comparison between two counts is satisfied by both
being ZERO**: the first structural clause counted `Object.keys(…ENDLESS.worlds)`
across `td-ui.js` and compared it against the sorted count — the picker
enumerates through a local alias, so both sides were 0 and it passed on nothing,
caught only because a sibling clause asserted the sorted count was 1. Slice the
FUNCTION and count what it does. **And fixing the data made the code fix
unfalsifiable** — reverting `byWorldOrder` to `Object.keys(W)` renders
identically on correctly-ordered data — so the behavioural test hands the picker
a REVERSED copy of the literal at runtime and asserts campaign order anyway,
with the injection asserted to have really reordered it. Same self-proving shape
as the build menu's fifth line and the difficulty chips' fourth tier.

**THE POWERS PACK IS A TRADE OF FOUR FOR FIVE AND NEVER SAID HOW OFTEN A POWER
COMES BACK.** Cost and ⚙️ charge were on every row; the cooldown — 20s to 30s
across the pool, which is most of what separates them — lived only in the 📖
Guide, one dialog away from the screen where the choice is made. Fifth surface
for the law that shipped the ⬆ upgrade preview, the `% road` figure, the ⭐ star
goal and the RUSH preview. Three things worth keeping. **The line takes its own
ROW inside the cost cell rather than joining it**, because that cell is
`white-space: nowrap` and is the documented iOS-wider-emoji spill that already
bit the tower panel, the next-wave line and the ability tile — measured, every
row's height is byte-identical at 320 and 390 and the cost column does not
widen, because the cost line is still the wider of the two. **It declares no
COLOUR on purpose**, inheriting `.td-node__cost`'s yellow/green, so it adds no
new pair to the fort's contrast surface and hierarchy comes from size and
weight. And **the in-battle tile's accessible name states it too** — the ⚙️
badge is `aria-hidden` and the tile has no room for the number, so a screen
reader otherwise never learns it at all. The clause that matters most is the one
guarding against a derivation that is really a constant: comparing each rendered
string against the same field the UI reads is satisfied by a hard-coded
`every 25s` if every cooldown happens to match, so a second clause asserts the
rendered values actually DIFFER between powers — which is what the hard-coded
mutation fires. **And the mutation run found a fixture defect worth more than
the feature: two of the three took the NEXT test down with them**, because an
assertion thrown mid-loop left the picker open over the fort home. A test that
opens a dialog owns closing it EVEN WHEN IT FAILS — a `finally` — or a real
failure presents as an unrelated test timing out, which this file already
records from the `resetSave`-without-`dropRun` bug and from a test that seeded a
checkpoint and never cleared it.

**TEN ENDLESS ARENAS LOOKED IDENTICAL, BECAUSE THE FIELD THAT SEPARATES THEM HAD
NO READER — and the fix was blocked by a guardrail that turned out to be right.**
TD-18 replaced ten identical Piñatas with one signature body per world precisely
so ten endless runs ask ten different questions, and `miniBoss` was then read by
the wave GENERATOR and by nothing else: no picker row, no guide card, no blurb.
So the whole point of that feature was learnable only by playing an arena to
wave 5. Both directions are stated now — the picker row says *spikes with 🛢️ Oil
Drum* (what makes this arena different, at the moment you choose it) and the
body's own guide card says *Headlines the 🔧 Garage endless arena* (what is this
thing) — the same both-ways reasoning as the costume lines, and both derived, so
an eleventh arena names itself.
Four things worth keeping. (1) **The obvious home for it was a 10th ♾️ Endless
section in the Toybox Guide, and a SHIPPED law correctly refused it**: the
contents row must fill evenly (`entries % columns === 0`), and 10 entries fit
neither 3 columns (an orphan) nor 2 (five rows, past the row's own 200px cap)
nor 5 (45px-wide entries at 320). The law's rationale — an even grid beats a
dense one when the count is fixed and small — held, and the right response was to
put the fact where the decision is rather than to widen the test. (2) **The
cadence is deliberately NOT on the rows.** Every arena spikes every 5th wave, so
ten rows repeating it carry zero per-arena information; it is stated once in the
blurb and once on the enemy card, and the guardrail asserts the rows do NOT
repeat it. (3) **A new trait line silently inflated a player-visible COUNT** —
the fort home's blurb counts distinct trick keys across the roster, so a "where
you meet it" line made it advertise 25 tricks when 24 mechanics exist. Caught by
running the derived count before writing the test. (4) **And fixing that
correctly turned a passing test RED, which was the real find**: the trick
classification was a literal in `td-ui.js` AND a second copy inside the browser
test, so classifying the new line correctly in the product made the test's stale
copy disagree. Two owners of a number the player reads. It is `TDLogic
.rosterTricks()` now, both consumers read it, and a scan asserts neither keeps
its own `NOT_A_TRICK` set. **When a correct product change turns a test red,
check whether the test was duplicating the decision rather than checking it.**
One smaller lesson: **wrapping a bare text node in a block to give it a second
line changes its ALIGNMENT** — the arena label had been hugging the left of a
`space-between` flex row as a text node, and inside a block it inherited the
dialog's centring and sat indented over its own spike line. Caught by the
screenshot, not by any measurement.

**THE THREE DIFFICULTY CHIPS NEVER SAID WHAT A LADDER DOES TO A RUN.** They
carried "😌 Easy / ⚔️ Normal / 💀 Hard" and their per-ladder progress, and
nothing anywhere in the app — not the chips, not the 📖 Guide, not one line of
copy — said what changes. The numbers are large and one of them is
counter-intuitive: **Hard hands you MORE starting gold** (+40), because heroic
was deliberately re-shaped into a pure hp/economy challenge rather than a speed
one, so a player reading only the icons has no way to know that the tier which
adds 30% toy health also funds a bigger opening. It is a derived line under the
chips now (`UI.difficultyEffect`), reading each tier's own fields — a neutral
field says nothing rather than printing "+0%", and a fourth tier explains
itself, which a runtime injection proves. Measured cost: the level grid starts
**34px lower** at 320 and 390, compared like-for-like against the same page with
the line hidden.
Three things worth keeping. **The obvious home was a 10th ♾️/⚔️ guide section
and the contents row's even-fill law refuses one** — the same refusal as the
endless work an hour earlier, so a fact that belongs at a decision now has a
second precedent for living AT the decision rather than in the manual.
**The reflow risk is asserted, not armoured**: tapping a chip must not move the
grid under the thumb, and a `min-height` reserving the worst case would be a
line whose removal changes nothing today — the unfalsifiable-change trap this
file has already deleted twice. **And the mutation that "should" have proven
that clause PASSED**: bumping the line's font-size scales all three sentences
equally, so the grid still does not move. The axis it actually guards is per-tier
LENGTH — making ONE tier's sentence wrap to an extra line fires it at 320px
(tops 530 vs 560). When a mutation passes, find the input that separates the
claims rather than widening the assertion; here that input told me what the
clause is really protecting, which is now written beside it.

**A GREEN LOCAL GATE SHIPPED A 1-IN-200 COIN FLIP, AND THE CLAIM THAT IT WAS
"SAFE BY MEASUREMENT" WAS THE DEFECT.** CI run #380 failed the 🏃 Marathoner
badge test with `fixture precondition: the board must actually survive to wave
20 (reached 3)`, and because `test` gates `deploy`, that run shipped nothing.
**Corrected on checking rather than assuming: the NEXT push's run carried both
commits and deployed them ~50 minutes later, so the flake cost a deploy CYCLE,
not the commits** — on a linear `main` the tip run carries whatever the failed
run was holding. The first draft of this entry (and of its commit message) said
it "held three finished commits off the live site", which was the alarming
reading rather than the measured one. The test seeds its endless run from
`Date.now()`, which is the only non-deterministic input in an otherwise
deterministic suite, and its own comment (and this file) recorded it as safe
because **8 seeds × 2 arenas** had all survived. Swept properly over **1200
seeds, 6 die before wave 20 (0.50%) — the worst at wave 3, which is CI's
signature exactly — and another 1.2% survive on ≤3 lives.** So it was a genuine
coin flip all along, and the reason nobody saw it is arithmetic: **a sample of 8
cannot see a 1-in-200 rate.** A "measured safe" claim has to be sized to the
rate it is claiming, or the word measured is doing no work.
Three things worth keeping. **My own first two probes reproduced the mistake** —
160 engine seeds and 20 full browser runs of the exact evaluate block, all
clean, which at 0.5% is the expected outcome about 40% of the time; I was one
band away from writing "not reproducible, cause unknown" and pinning a seed
without understanding why. What broke it open was not another repro attempt but
asking for the DISTRIBUTION (min lives across a range), which came back with a
seed finishing on **1 life** — a board one bad roll from dying is not a robust
fixture, and that single number reframed the whole thing. **Ask what the spread
is before concluding a rare failure is unreproducible.** Second, the pin is
chosen on headroom rather than convenience: seed 1066 finishes wave 21 with 20
of 20 lives, the most in the range scanned, so it is not sitting next to the
cliff. Third, the hook had to grow the ability to be pinned at all
(`__TD.startEndless(world, opts)` now passes `opts` through exactly as
`startEndless` already did), and the loop now breaks the moment a wave fails to
return to build — calling again while one is still walking STACKS waves (TD-15
⏩ RUSH), which is the one path that could bury this board early, and the
failure message now names phase, lives, seed and difficulty so the next
occurrence is diagnosable in one look instead of five probes.

**A BADGE TOAST SAT ON THE POWER STRIP AT THE START OF EVERY SINGLE RUN.** Found
by screenshotting the fort's BATTLEFIELD at tablet size, which nothing had ever
done — every play-screen test measures the canvas or a control, none looks at
the picture. The toast is `position: fixed` 24px from the bottom, which in
portrait is exactly where the power strip and ▶ CALL live. Measured before the
fix: at 320px a mid-run badge covered **two power tiles completely plus 1368px²
of CALL**, and 74%/74%/60% at 390 — and 🩸 First Blood fires on your first kill,
i.e. in wave 1 of every level, so this happened at the start of every run. It
could never steal the tap (`pointer-events: none`, an earlier audit's call) but
it hid the thing you were reaching for. The lift is DERIVED from where the
controls actually are rather than being a constant, which is what lets landscape
— where the strip is a side gutter and the measured overlap is zero — keep the
low position; the mutation that makes the lift unconditional pushes the toast to
`top 11`, into the field. Note the shape of the find: the screenshot showed the
tablet, where one tile was 51% covered, and MEASURING then showed the phone was
far worse. **Look at the picture to find it, measure every size to size it.**
**And the first two failures were my own FIXTURE, twice over.** A `querySelector
(".td-toast")` returns the OLDEST toast, because they are appended — so at the
next viewport I was measuring the PREVIOUS layout's toast, still carrying its
stale absolute position, which reads exactly like the product failing to lift.
That is the `.win-hero` trap this file already records for the buddy test,
committed again by the person who wrote it down. The tell was in the
diagnostic: the computed `bottom` was byte-identical (`calc(108px …)`) at five
different viewports, which no per-viewport derivation could produce. The test
clears toasts, reads the LAST one, and asserts there is exactly ONE, so a stale
toast can never be what it measures.

**ONE TOWER LINE HAD THREE NAMES AND TWO ICONS ACROSS THREE SCREENS.** Found by
screenshotting the DEFEAT screen, which nothing had ever done. Its one piece of
actionable advice — the counter-matrix line, the only place the game tells you
what to build — read **"Try: dart or fan."**: `reachedBy` returns engine KEYS
and they were being joined raw into player copy. That is the `cheap` class
again (an identifier shipped as a sentence), and worse than usual, because the
build menu shows an ICON and a ROLE and no name at all, so the advice named
things that appear on no screen. Chasing it found the bigger half: the 📖 Guide
kept its own `{ dart: "🎯", mortar: "💥", fan: "❄️", camp: "🪖" }` and the run
summary a third map with the same wrong glyphs — while the build menu paints
`DATA.TOWERS[id].icon`, which is **🧱 for the mortar and 🧊 for the fan**. So
the manual and the post-mortem were teaching two symbols that appear NOWHERE
else in the game: look a line up, then fail to find it on the menu.
Three things worth keeping. **The data is the owner and the UI gets a
FORMATTER, not a table** — `UI.lineIcon`/`UI.lineLabel` read `DATA.TOWERS`, and
a `short` field (the `ABILITIES[].short` precedent) lets the summary's tight
bars stay tight without minting a third spelling. **The structural scan is
derived from the ids**, so it bans a *fifth* line's map too, and it is the half
that stops a fourth table appearing; the browser test beside it is the half that
proves the three surfaces actually agree, which a scan cannot. **And the
screenshot is what found it** — every one of these strings is produced by code
that reads fine in isolation, and the disagreement only exists between screens.
One finding from the same pass was REJECTED after looking properly: the L10-style
lever renders as a red disc with a white diagonal, which at phone size reads
like a "forbidden" sign on a control labelled TAP — but at 4× it is plainly a
switch handle with a knob, and the bar stops short of the disc edge rather than
crossing it corner to corner as a prohibition mark does. Working art; no change.

**AND THE SAME DEFEAT SCREEN OFFERED TWO WAYS BACK IN WITHOUT SAYING WHICH WAS
WHICH.** 🔁 Try again replays the run's OWN seed — the identical wave order you
just lost to, so you can answer the puzzle you actually met — and 🎲 New shuffle
rolls a fresh one. That is a real choice, and it was presented as two buttons
that look like the same button. Each carries a second line now ("the same
waves" / "a different roll"), as ink rather than a `title`, which is hover-only
on a phone. Measured cost: the box grows 6px at 390 and nothing at 320.
Three things worth keeping. **Player copy that describes behaviour is a CLAIM,
so it is driven rather than merely rendered**: the test clicks Try again and
asserts the new run carries the same seed, and the mutation that gives it a
fresh one reports `seed 90146 vs 5` — the words becoming a lie is what goes red.
**The other half is pinned STRUCTURALLY on purpose** — comparing two
clock-derived seeds would be a 1-in-100000 flake, and this session has already
paid for a 1-in-200 one. **And ENDLESS must NOT grow the line**: its run is
generated fresh either way, so there is no distinction to explain, and the
mutation that adds one there is red too — a label explaining a difference that
does not exist is its own defect. One scan note: there are THREE `retry:`
handlers (daily, endless, campaign) and an unanchored `indexOf` finds the
daily's, which has no seed at all and fails for the wrong reason; `retrynew:` is
unique, so the scan anchors on it and walks back, asserting the gap is small
enough to BE the same handler pair.

**TWO STAR-TREE NODES DESCRIBED A MECHANIC YOU MAY NEVER OWN, AND ONE IS INERT
ON 39 OF 40 LEVELS.** Found by enumerating every field of `DATA.LEVELS` against
its readers — the one big config surface never swept — which reported `night` on
**exactly one level of forty**. 🦉 Night Owl (⭐2) halves the night reach penalty,
so it is a node whose entire value applies once in a campaign, in a 6-slot
loadout economy, with nothing saying so; and the confinement is deliberate rather
than an oversight, since this file already records night as untunable (a −15%
reach cut held a world's mid level at heroic 0/3 across a 600→1500 gold sweep).
The same sweep found the sharper pair: **🪃 Ricochet (⭐5) and 🔗 Live Wire (⭐4)
both describe "the Fan's chain", and the Fan does not have one** — `chain`
appears on exactly ONE stat block in the game, the tier-4 Static Zap branch — so
⭐9 of tree explains a mechanic you only own after a 300-gold purchase you may
never make. This is the `cheap` lesson one layer out: there a description
MISNAMED a mechanic, here each is TRUE and silently conditional, which reads the
same way to the person spending the stars. Four things worth keeping. **The gate
is keyed on the MOD KEY the node moves, not on its id**, and that key is obtained
by diffing `metaMods([id])` against `metaMods([])` — the engine's own answer
rather than a second table — so renaming a node cannot silently drop its gate.
**Every number in the text is derived**, and the clause that proves it had to
move the data underneath: comparing the rendered string against the same
`LEVELS.filter(l => l.night).length` the owner reads is satisfied by a literal
`"1 of 40"`, so the test injects a second night level and requires the count to
follow (and renames the branch and requires the name to follow). **It is shown
only where there IS a gate** — a line on all forty rows would be decoration,
which is the fort's own rule for the meta-row badges, and the mutation that
renders one everywhere goes red on exactly that clause. And **the dead-content
law rides along**: if `night` ever left the campaign, Night Owl would not be
merely situational but unreachable, so the guardrail asserts the gate's subject
exists at all — the same class as heroic shipping with no selector. One method
note: a fifth mutation reported `SETUP FAILED` rather than a false pass, because
the harness asserts its anchor matches exactly once and that the byte count
moved. That check is the only reason it was not read as a passing clause.

**THE 📖 GUIDE'S NINE SECTION HEADINGS WERE SMALLER AND QUIETER THAN THE BODY
THEY INTRODUCED.** Found by screenshotting the guide section by section, which
nothing does — every guide test asserts derived CONTENT (a trait line, a mode's
name, one entry per section) and none had ever looked at the page. Measured, each
heading rendered at **14.72px / weight 400 / #cfe2ff with margin 0** against a
**16px** body, because a section marker was just the section's own prose wearing
`.td-overlay__sub`, the class every dialog uses for its subtitle. So a 17,000px
document — two dozen screenfuls over nine topics — had no landmark anywhere: the
contents row shipped earlier can JUMP to a section, and a reader scrolling had
nothing at all. Three things worth keeping. **Styling the existing element was
not enough, and the screenshot is what showed it**: two of the nine "headings"
are whole explainers (Powers is 745 characters), so making them gold and bold
produced a three-line shouting paragraph. The label had to become its OWN
element — and its text comes from the same `data-sec` attribute the contents row
derives its buttons from, so the thing you land on and the button that took you
there cannot disagree. **The heading needs AIR as well as weight**, which is a
separate clause because a bigger word in an unbroken column is still a wall: the
mutation that keeps the gold and removes the margin fires only that one.
**And a shipped guardrail went red, correctly, on a PROXY.** `rosterHasSection`
demanded the heading be the roster's *immediately previous sibling* — true while
a section was one element doing both jobs, and false the moment a section became
a heading plus a paragraph. The property it means is *nothing from another
section sits between*, so it walks back to the nearest heading and fails on an
intervening list. **Isolating that repair took a second mutation**: deleting the
Enemies heading outright fires the even-fill law first (8 entries in 3 columns),
so it proves nothing about this clause — the honest mutation keeps all nine
sections and slips another section's `<ul>` between the heading and the roster,
which is the original defect's exact shape.
**And TWO MORE shipped scans went red on the copy edit, for the same reason one
level down**: both bounded the guide's Powers section with a SENTENCE of its
prose (`ui.slice(indexOf("Powers — usable during a wave only"), indexOf("The
wave button"))`), so a wording change made both `indexOf` calls -1 and the
region the empty string — every assertion inside it then failed at once. This
file already records that a region bound must be asserted to BE a region, from
the case where a bad slice handed back the rest of the FILE; the empty slice is
its mirror, and it is the friendlier of the two because it fails loudly instead
of matching everything. Both now slice on the SECTION MARKER the contents row
also derives from, with an explicit non-empty check, and both were re-proven
against their own defects (re-typing the per-wave grant as a literal, and
deleting the section) rather than merely made green.
**And the same pass found its sibling: the guide's PROSE was centred.** Its
lists and enemy cards already carry `text-align: left` — somebody fixed the
long-form content there and the paragraphs around them were missed, which is the
shape this file keeps recording. Measured centred, the Powers paragraph runs
**14 lines at 320px** and the Chips one 7, ragged on both edges; every other
paragraph is 1-2 lines, where centring reads as a subtitle and is fine. A
length-based rule is not available (CSS cannot see it, and a JS threshold is the
invented-threshold trap), so the honest form is the surface-level one: the guide
is the one dialog that is a DOCUMENT rather than a row of controls, so its whole
body column reads left and the chrome — the dialog title, the contents row —
stays centred. The guardrail is derived over every body run rather than a named
list, with a clause that long-form prose actually EXISTS, or the claim is moot.

**56 ENEMY CARDS PRINTED `❤️ 34 · 🏃 0.8 · 🪙 5` AND NOTHING ANYWHERE SAID WHAT
ANY OF IT WAS.** ❤️ and 🪙 are guessable; **🏃 is not** — it is cells a second
(`dist += effSpeed(e) * DT`), a unit no surface states, and a bare 0.8 has no
anchor at all until you have read several cards. Same class as ⚙️ Toy Energy
shipping as a bare numeral, now on the biggest reference surface in the game.
The section that introduces the cards names each figure, and the anchor is a
DERIVED range (`rosterSpeeds()`, bosses excluded because they are deliberately
off the scale the crowd sets). 🛡️ armour and 🔋 shield need no gloss there —
they appear only where a toy has them and that card's own trait line already
says what they do — so the legend only says they are conditional.
**Both of the first two mutations PASSED, and each was a different way of
sampling too little.** The glyph loop derived its set from the FIRST card's stat
row — and the first card has no armour and no shield, so the two CONDITIONAL
figures were silently exempt and deleting them from the legend went green; it
walks the union of all 56 rows now. And the range clause compared the rendered
text against the very values the owner returns, so a typed `0.45–2` satisfied
it — the flattening trap, committed again two entries after writing it down.
Only a roster the literal cannot know falsifies it: inject a 99-speed body, re-
render, and require the number to follow. **When a mutation passes, the question
is not "is the assertion strong enough" but "what did the fixture never show
it".**

**THE GATE LINES SHIPPED TO THE ⭐ DIALOG AND NOT TO THE 📖 GUIDE, WHICH LISTS
THE SAME FORTY NODES.** Caught by screenshotting the guide's Tree section an hour
after shipping the gates: `Ricochet — The Fan's chain jumps one more (5⭐)` was
still bare there, so the reference and the buy screen said different things about
the same star. That is the sibling-surface shape this file keeps recording (the
Sticker Book's ghost, the tile-icon law, the tablet clamp pass) — a fix applied
where it was found and not where the same fact also appears. Both read
`TDLogic.nodeGate` now, and the guardrail checks BOTH from the one owner rather
than the surface it was written against. **The same screenshot found the
reference incomplete in the other direction**: every tier-4 branch under the four
tower lines states its price and the LINES themselves did not — so the guide
carried the number for the 300-gold ultimate you may never buy and omitted it for
the 70-gold purchase you make first, ten times a level. Read from the tier-1 stat
block, never re-typed.

**EVERY BALANCE CLAIM IN THIS FILE RESTS ON EIGHT TOOLS THAT NOTHING RAN.** They
are referenced six times in `td-logic.test.js` — *"sweep it with
tools/td-fork-search.js"*, *"run `node tools/td-sim.js 38 --lever`"* — and every
one of those references is a COMMENT. That is the standing pairing inverted: a
comment proves a tool was used once; only running it proves it still loads the
engine and the data it reads. A bit-rotted tool (a renamed export, a moved
field) is otherwise found mid-investigation, where the natural reading is that
the GAME changed rather than the instrument broke — and this file already
records four separate occasions where a broken instrument produced a confident
wrong answer about the product. Measured first: **all eight run clean on today's
data**, so this is coverage rather than a fix, which is the honest half to write
down. A smoke test now drives each at the smallest scope that still does real
work — **1.8 seconds for all eight** — and asserts it exits clean, prints
something, and prints a NUMBER, because a measuring tool that measured nothing
is the failure that looks most like success. The population is DERIVED from
`tools/` and the per-tool scope is a NAMED map (a minimal invocation cannot be
derived — they take different knobs), with the two tied together so a ninth tool
is red until somebody gives it one. Mutation-proven three ways: point a tool at
a renamed module, add a tool with no scope, and make a tool exit silently.
**And the first version of that test had its own gap, one level down: it ran
each tool's DEFAULT arm.** `td-sim.js` has six flag arms (`--lever`, `--boss`,
`--gold`, `--branch`, `--priority`, `--swap`) and `td-wave-gen.js` has `--emit`,
and most of the findings in this file came from them — so seven of nine
documented arms were unverified by the very test written to close that gap. The
flag list is DERIVED from the sources now (`argv.includes("--x")`) and every one
must have an arm, with `--focus` named as an OPTION of `--priority` rather than
an arm of its own. **The sharper half is that "exits 0 and prints a digit" is not
enough, and it was measured rather than argued**: `--swap` reads its two operands
as backbone SLOT INDICES, so passing enemy type NAMES makes them NaN and the arm
prints `undefined → undefined … (0 groups, budget drift 0.00%)` — clean exit,
digits and all, having done nothing. Each arm names a phrase a WORKING run
prints. **And my first such signature let the no-op straight through**, because
`\d+ groups` matches `0 groups`: a count that accepts zero accepts nothing
happening. Two of my own expectations were also simply wrong (`td-gold.js` prints
`maxed-board gold`, not the `--gold` arm's `startGold`; and pinning `DIFFS=normal`
removed the heroic column the signature asked for), which is the signature doing
its job before the test ever shipped.

**A SHEBANG ON A NON-EXECUTABLE FILE IS A DECLARATION THAT DOES NOTHING**, and
all eight research tools carried `#!/usr/bin/env node` at mode 644 — which is
why this file's own `W9=1 tools/td-map-search.js` could not be copy-pasted: it
dies with "Permission denied" while the identical line with `node` in front
works. The repo already had the convention (`.claude/resync-main.sh` has always
been executable), so the tools were the exception rather than the rule; they are
755 now and both documented forms run. The guardrail is DERIVED over every
tracked file, so a ninth tool inherits it, and it reads the **git INDEX rather
than the working tree** — that is what a fresh clone gets, so a local `chmod`
nobody committed must not make it pass. That is a control rather than a
mutation, and it is stated because the natural reading of "it passed" is that
the check is weak.
**And the finding that started this was a FALSE one I nearly acted on.** Scanning
the tools for env knobs with `process\.env\.[A-Z_]+` reported `W` for
td-map-search, so `W9=1` looked like a documented invocation reading a knob that
does not exist — a stale-command finding of exactly the class this file records
ten times. It is not: the character class has no digits, so `W9` and `W10`
TRUNCATED to `W`. Running it is what settled it (`W9=1` correctly prints L33/L34).
A scan's own pattern is part of the scan, for the eighth recorded time, and this
one produced a plausible defect report about the documentation rather than a
missed one — the failure mode that wastes a fix rather than hiding a bug.

**THE 📅 DAILY CARD STATED THE DAY'S ARENA, ITS CHIP AND BOTH BESTS — and hid
that a daily is PINNED TO NORMAL, which is the one rule on it a player can be
wrong about.** The card's own comment enumerates what it exists to say ("which
arena, which chip (if any), and both bests") and `startDaily` quietly passed
`difficulty: "normal"` as a literal, so a player sitting on the 💀 Hard chip
pressed ▶ Play and got Normal with nothing said. The pin is right — a daily is
one shared puzzle — but a rule stated nowhere is the `cheap` class one layer
out. Fixed by making the ladder part of the PICK: `dailyPick` returns it, and
both the start site and the card read that one owner, so the card cannot say one
thing while the engine does another. Two smaller defects on the same card: it
printed **"Today's best: wave 0"** before you had played (a bar, not progress —
the 🏃 Marathoner rule, and the sibling of the "🏆 12 — twelve of WHAT" defect
the endless picker was fixed for), and it named the arena without its **spike**,
which the sibling picker had just learned to name — so `UI.arenaSpike` is now
the one owner and the test compares the two SURFACES rather than both reading
the helper, because the claim worth pinning is that they agree.
**The clause that matters is behavioural and cannot flatten**: reading the
ladder off `pick` at both ends would move together, so the run is DRIVEN and the
card compared against `state.difficulty`. One clause catches the mutation in
either direction — point the card at the save and it advertises Hard while the
run is Normal; point `startDaily` at the save and the run is Hard while the card
says Normal. It is falsifiable only because the fixture puts the fort chip on
Hard first, which is asserted.
**AND THE FIRST CUT WAS A REGRESSION I INTRODUCED AND MEASURED — two extra lines
cost +67px and pushed ▶ Play below the fold at 320×480 and in landscape.** The
A/B is the honest one (the same page with the new lines `display:none`, not a
different save state). The fix is where the fact BELONGS rather than a trim: the
card holds what changes daily, and the pin is true every day and is the second
half of the sentence the blurb already makes — same seed *and same rules* is
what makes a best a fair best — so it is a `<b>` inside a paragraph that already
exists and costs zero rows.
**The last 38px came from trading the axis that was spare.** Short landscape is
HEIGHT-constrained and had 484px of unused WIDTH (`.td-overlay__box--wide` is
`min(360px, 92vw)` at every size), so every paragraph wrapped more than it
needed to; a landscape-only width bump buys headroom for all nine dialogs there
and cannot touch portrait, because `orientation: landscape` never matches a
portrait tablet. Result: landscape costs **+1px instead of +38**, with 38px of
clearance rather than 1px.
**Three testing notes.** A `boxW > 400` clause was written and REPLACED: box
width is a quantity that *correlates* with headroom, and this file has already
been caught asserting a proxy (`wrapW >= viewport.width`) — the clause asserts
the clearance itself now, with a bar (15px) that is a measured separation
between the two states rather than a number beside either. The fold guardrail
uses FRESH CONTEXTS per size, never `setViewportSize`, which is the documented
reason the 834 comparison-game check once survived its own mutation. And the
all-time clause had to be moved ABOVE the zero-score clause to be provable at
all: the mutation that makes the all-time line unconditional prints "All-time
daily best: wave 0", which trips the zero-score clause first — the
earlier-clause trap, caught only by running the mutation and reading which
assertion fired.

**THE STAR TREE'S OTHER BUDGET SCROLLED AWAY, AND ITS ＋ REFUSED IN SILENCE —
both already fixed once, next door, and never carried across.** The ⭐ budget was
moved onto the sticky strip a release earlier because it is the number all 40
nodes are judged against and the dialog is 2900px tall; **🎒 N/6 packed is the
second such number and was still in a paragraph at the very top**, so it was gone
the moment you began browsing. It is the sharper of the two: at 6/6 every
un-equipped ＋ goes `disabled`, so the count is the *explanation for a control
that just refused you* — and that ＋ carried no reason at all, no `title` and a
bare "Equip X" aria-label on a dead button, which is precisely the law the 🎒
Powers picker was fixed for one dialog over ("a control that cannot be used says
why"). The SENTENCE stays at the top (it explains the mechanic and is read once);
only the NUMBER moves. Measured free: the strip is **70px in both arms at 320,
390 and landscape** — the note wraps to a second line and the strip does not
grow, because its height is already set by the 44px ✕ — and the note never
reaches the ✕ (a flex row cannot overlap).
**The refusal wording now has one owner, and the drift was already there to
find**: inside ONE expression the `title` read *"Pack is full — take one out
first"* and the aria-label *"Pack is full, take one out first —"*, i.e. the
sighted and the spoken copy had come apart by a comma and a dash before anyone
copied either of them anywhere. The test compares the two racks' RENDERED
strings rather than reading the shared constant at both ends, so the mutation
that moves the shared wording correctly stays GREEN (both follow) while
re-inlining a drifted copy at one site goes red. Note one deliberate asymmetry,
written into the code: the Powers picker disables the whole ROW as well, and the
tree must not — there the row BUYS and refunds.
**And the mutation that "proved" the sticky half PASSED, because I wrote a
mutation that did not mutate the thing under test.** It ADDED the count back to
the header while leaving the sticky one in place, so `querySelector` found the
good one first and the test was satisfied. Two lessons, and the second is the
one worth keeping: a MOVE has two halves and a mutation that performs one of
them is not that move; and the test was reading `querySelector`, so a duplicate
anywhere would have let it grade the wrong element — it asserts **exactly one**
match now, which is what turns a bad mutation into a visible failure instead of
a false pass. Also swept up: `.td-tree__avail` was declared TWICE with identical
values — benign today, and the "a size declared twice has no owner" class, where
the next edit to one of them silently disagrees with the other.

**THE GAME'S OWN MANUAL WAS UNREACHABLE FROM INSIDE A BATTLE — and the metric
written to prove the fix was safe could not fail.** The 📖 Toybox Guide holds the
counter matrix (only two lines reach air, armour halves a dart's bonk, a shield
eats the Fan's zap), which this file calls the heart of the game, and it opened
only from the fort home. So the moment you most need it — an unfamiliar body is
walking and you are deciding what to build — reading it cost you the run. The
DEFEAT screen already links to it, i.e. the game already believed *when you are
stuck, read this*; it just offered it one wave too late. Same law as the ⬆
upgrade preview, the `% road` figure and the ⭐ star goal, now on the play screen.
Three things made it nearly free: `metaOverlay` already picks the unhidden screen
(the fix that let the guide open from the defeat overlay), the pause menu already
existed, and the run is already paused — so the only new machinery is an `onDone`.
**That `onDone` is the whole safety argument, not a nicety.** The guide REPLACES
the pause menu, and closing it without re-opening strands you on a paused
battlefield whose only obvious control (⏸) **RESUMES** — so the way out of the
manual would be to lose your pause. Both exits carry it, the ✕ included, and both
are driven.
**The measurement that mattered was the one that said the change COSTS
something.** A/B at five sizes: the 7th button separates 6 from 7 at exactly ONE
of them — 320x568, where the menu goes from all-visible to needs-a-scroll (box
524 → 544 against a 544 cap) — while 320x480, 844x390 and 667x375 already
scrolled at six and 390x844 has slack either way. Written into the test, because
"a size earns its place only if it can SEPARATE the two states" cuts both ways:
listing four sizes while only one can catch this would imply four protections
where there is one. The cost is accepted rather than designed away (this dialog's
answer to not fitting has always been to scroll, every button stays at the adult
44px floor), and the two alternatives are named so nobody re-opens them:
tightening the gap between two DESTRUCTIVE buttons, or turning three labelled
toggles into icons, each trade away more than they buy.
**AND THE SHARPEST FINDING IS A PREDICATE THIS REPO HAS BEEN USING FOR
REACHABILITY ALL ALONG: `box.scrollHeight > box.clientHeight` IS NOT
SCROLLABILITY.** It is content OVERFLOW, and a box that CLIPS — or spills
visibly — reports it identically. Proven rather than reasoned: deleting
`overflow-y: auto` from `.td-overlay__box`, which is the exact defect that dialog
was fixed for (a 390-tall landscape viewport clipping the title above and the
quit button below), left the predicate TRUE and the mutation PASSED. The honest
form is to scroll the box for real and ask whether the button arrived; it then
reports *"it sits at 515..571 in a 480px viewport, and scrolling the box is not
possible"*. The same predicate was live in the SHIPPED pause test, so it was
corrected there too — with a note that its half is currently VACUOUS at that
test's own 390x844 viewport, where the menu fits outright and the fits-branch
short-circuits it, so the clip mutation is carried by the short-size sibling.
Say which half is load-bearing rather than implying both are.

**THE MOST DESTRUCTIVE ACTION IN THE FORT WAS ITS ONLY UNGUARDED ONE.** Found by
screenshotting the 💾 Backup dialog, which nothing had ever looked at. 📥 Restore
replaces every star ladder, the star tree, the badges and the endless bests, with
no undo — and the save it overwrites may be the only copy — and it shipped as ONE
TAP, while **⚙️ Reset fort, which does strictly LESS damage (it keeps preferences,
and a backup can undo it), sits behind a type-the-word gate**. Two destructive
buttons in the same admin row with opposite policies is this project's most
repeated tell, and it is the pause menu's 🔁 Restart defect exactly: there too the
sibling had the confirm and the worse action did not. It goes through `UI.confirm`,
the fort's ONE owner for this.
**The confirm NAMES BOTH SIDES, and that is the design rather than a flourish.**
The danger here is not a mis-tap — restoring your own save is a no-op — it is
pasting an OLDER backup over newer progress, which is invisible until it is gone.
"Are you sure?" cannot catch that; *"Now: ⭐ 27 · 🏅 3 → Backup: ⭐ 3 · 🏅 1"* can.
Both summaries come from one `UI.saveSummary`, so the two sides are measured the
same way, and it is defensive on every field because the incoming blob has only
been checked far enough to know it parses and carries a `stars` object — a
missing `ach` must read 0 rather than throw inside the dialog whose whole job is
preventing data loss.
**Two smaller things the shape forced.** A cancelled restore must not cost you the
paste: `UI.confirm` builds an overlay, which REPLACES the backup dialog, so
re-opening it has to carry the pasted text back in — re-reading the CURRENT save
there would silently discard the very text you were weighing up (its mutation
reports *"must not throw away what you pasted"*). And the preview gives one
question two askers, so the shape check became `readSave`, with a structural
guardrail that it is defined once, called exactly twice, and that **no second
copy of `.v !== 1` exists** — otherwise the dialog could confirm a blob the write
then refuses. That last clause needed its own mutation to be provable: the
obvious one (previewSave re-deriving the check inline) also drops a call site, so
the COUNT clause fires first and leaves it unproven — it takes a mutation that
adds a redundant check while keeping both call sites, which is the earlier-clause
trap once more.
**AND THE NEW TEST IMMEDIATELY FOUND A PRE-EXISTING DEFECT IN THE PATH IT WAS
WRITTEN AROUND — because it was the first thing ever to paste a MINIMAL blob.**
The gate went red on `no uncaught page errors in the fort run` with *"Cannot read
properties of undefined (reading 'music')"*. Cause: **a reload is not
synchronous.** `importSave` did `save = incoming; persist(); location.reload()`,
and the page keeps running until the navigation commits — so a partially-shaped
blob installed as the module's live save is read by whatever fires in that
window, here the music predicate reaching for `save.settings.music` on a backup
that carries no `settings` (a hand-edited one, or an older export). The fix is to
never install it at all: `persist(r.save, {force:true})` writes the blob and the
reload boots it, so **the boot loader is the only place a restored save is ever
met** — which is what the loader's coercions are for. Two method notes. It was
**verified rather than asserted to be pre-existing**: a `git worktree` at the
previous commit reproduces the identical throw with no confirm dialog present at
all, which is what makes "my change did not cause this" a measurement instead of
a story. And the clause that pins it is a `pageerror` listener scoped to the
test with `page.off` in the `finally`, because a shared page's error listener
that outlives its test turns the next failure into someone else's.
**THE 40-CARD LEVEL GRID STAYED TWO COLUMNS AT EVERY WIDTH, so a tablet scrolled
exactly as far as a phone.** The 3→2 change was made for a 390px phone and was
right there; above it, it stops being a layout and becomes a waste. Measured
across six widths: the cards go **177px → 342px** — a nearly 4:1 letterbox
holding a number, a name and three pips — while the grid stays **2452px tall at
every size**, with 328px of width unused at 1024. Four columns above 720px takes
the grid to **1458px** (about a thousand pixels less scrolling to reach world 10)
at a 165px card, which is the phone's own 177px, so the card design is unchanged
in character. The phone is byte-identical, because the rule is a `min-width`.
**Three things decided it, and all three were measured rather than reasoned.**
FOUR, not three: `levelsPerWorld % columns === 0` is the shipped orphan law, and
separately **three columns costs the SAME number of rows as two** — four cards
still take two rows either way, so the grid stays 2452px while every card gets
narrower, i.e. strictly worse than what it replaces. And **720 is a crossover,
not a round number**: at four columns a 720px screen gives a 165px card with 1 of
40 names wrapping, 600px gives 135px and 15 wrap, and 390px gives 83px and 39
wrap — which is exactly why the phone keeps two.
**The measurement was VACUOUS on its first run, in the way this file keeps
recording.** A LOCKED level card renders no name (it shows "win N ⭐"), so on a
fresh save only one card in forty has a `.td-level__name` — and the wrap count
that decides the whole column choice came back `0/40` at 83px, which is
impossible. The fixture now unlocks the campaign, and the test asserts
`named === cards` before believing any wrap number. **When a count comes back
zero, check that the fixture ever produced the thing being counted.**
**And the orphan clause needed a third mutation to be proven at all.** Removing
the rule fires the column clause; three columns fires the *height* clause first
(because of the same-rows result above), so neither reaches the `% columns`
assertion. Only FIVE columns — shorter grid, column count up, but 4 % 5 ≠ 0 —
isolates it, reporting *"5 columns orphans a card in every world of 4"*. The
earlier-clause trap again: a mutation that fires an earlier clause has not proven
the later one, and finding the input that separates them is the work.
**THE FIRST CUT WAS WRONG AND A SHIPPED GUARDRAIL CAUGHT IT — the very law I had
quoted while reasoning.** At a 720px breakpoint the tablet card is **165px
against the phone's 177px**, and *"a bigger screen gives the fort BIGGER
controls, never more cramped ones"* went red naming both numbers. The lesson is
not that the law is too strict; it is that **the cause was one layer down**.
`main.css` widens `#screens` to 900px above 600 and then caps every
NON-navigation `.screen` back to 720 — and that exemption list names Josh's and
华丽's nav screens while omitting the fort's, because the fort was built after
the list. The fort home is a level PICKER, not a game stage. Adding `.td-home`
to the list is the actual fix: four columns then give **177px at 768, 194 at 834
and 210 at 1024**, so the card only ever grows. Ninth instance of a hand-written
scope going stale, and the first where the stale list was in a *different
world's* stylesheet.
**The breakpoint is then ARITHMETIC, not taste**: a phone's card is
`(366 − 12) / 2 = 177`, so four columns need `4×177 + 3×12 = 744px` of grid,
which is exactly a 768px viewport once its padding is taken. 720 was simply too
eager. **And that number was UNPINNED until a fourth mutation** — every viewport
at or above 768 is wide enough whichever value the query carries, so moving it
back to 720 passed every clause. The separating input is a width *between* them:
at 740 a four-column grid is 170px, under the phone's 177. The clause asserts the
property at that width rather than pinning the number, and reports exactly that.
**AND LOOKING AT THE RESULT — rather than only measuring it — found that the same
change had made the META ROW ragged.** With the screen at 900px `auto-fit` finds
room for five tracks and the row holds SEVEN buttons, so it laid them out **5+2**:
three empty cells, a stranded 📅/📖 pair, and buttons that went **180px at 768 →
156 at 834 → 169 at 1024**, i.e. a wider screen handing back a narrower control —
the very defect this screen's own law exists for, reintroduced by widening it.
The shipped law could not see it, and correctly so: its comment says in as many
words that it is deliberately NOT strict monotonicity, because a wrapping grid
STEPS when it gains a column. Pinning four columns above the same breakpoint
removes the stepping, which makes monotonicity true and therefore assertable —
and is better on every axis at once (**4+3 with one empty cell, 180 / 197 /
213px**). Seven across was measured too and is worse: one row, but 99-118px
buttons with labels wrapping. Same even-fill reasoning as the 📖 Guide's contents
row and the level grid — when the item count is FIXED and small, an even grid
beats a dense one. **The general point: a layout change is not finished when its
own numbers are right; look at the screen, because the thing it broke is usually
a NEIGHBOUR that no clause was watching.**

**AND THE PLAY SCREEN HAD THE SAME SHAPE OF DEFECT, one layer further out: the
control row was laid out against the SCREEN while the battlefield is sized by the
RENDERER.** In portrait the board is height-limited on anything bigger than a
phone, so the canvas narrows and the row does not. Measured at 834x1112 the row
ran **x 69..765 against a field of 144..690** — which puts **▶ CALL, the button
the entire build phase is about, completely outside the battlefield**, with the
power strip overhanging 75px the other way; 768 was worse (CALL 36..128, field
starting at 132). On a phone the two coincide (378px canvas, 366px row), which is
why nothing had ever noticed.
**CSS cannot know that width — only `resize()` computes it** — so the renderer
publishes it as `--td-field` and the portrait row takes `max-width:
var(--td-field, 100%)`. Three details worth keeping: the property is set on the
SCREEN rather than the canvas wrap, because custom properties inherit downward
and `.td-controls` is a SIBLING of the wrap; a `max-width` cannot force growth, so
the phone is provably untouched (its row keeps all 366px); and LANDSCAPE is
deliberately excluded, because there the row is an absolutely-positioned side
gutter beside the board and dragging it under the field would be meaningless —
its mutation is red on exactly that clause.
**The fixture clause is the one that makes the rest mean anything**: it asserts
the field really is narrower than the screen at each size, because if the board
ever filled a tablet the containment check would pass with nothing to contain.
Same lesson as the vacuous wrap count one entry up — assert the condition the
defect needs before believing the assertion about it.
**AND THE FIRST CUT BROKE THREE SHIPPED TESTS, of which only ONE was a real
defect — the other two were CASCADE, which is worth as much as the fix.** The
premise "on a phone the field fills the screen" is false: a SHORT phone is
height-limited too, so 320x480 gives a **168px** field and 320x568 a **224px**
one, and capping the row to that squeezed the power tiles into each other
(measured gaps of **-25px** and **-11px**). The shipped overlap guardrail caught
it. The other two failures were the ART corpse tests, which do not touch the
control row at all: the overlap test drives the SHARED page through
`setViewportSize(320, …)`, and because it FAILED it never restored the viewport,
so every later test in that file ran on a 320-wide page with a tiny canvas and
read "the death drew only 124 pixels". **When several tests fail at once, check
whether the later ones share global state with the first** — three red lines were
one bug.
**The fix then had to be collapsed from two mechanisms to one, because neither
was falsifiable while both were present.** A `min-width: 600px` scope and a
`min-width: min(100%, 344px)` floor each fixed it, so removing EITHER left the
suite green — the redundant-fix trap this file has already deleted lines for
twice. Measured, the floor alone gives identical results at every width (296 at
320, 336 at 360, 366 at 390 — each the exact shipped natural width, so phones are
inert; 504 at 768, 546 at 834 — capped), so the scope was deleted. `min-content`
was tried and does not express the floor: the strip's track is `minmax(0, 1fr)`
BY DESIGN (a wide child would otherwise inflate it — the documented 360px
cliff), so the grid's min-content is ~0 and it squeezes anyway. The number is
derived from the row's own constants — ▶ CALL's 92px track + an 8px gap + five
44px tiles + four 8px gaps = 344 — and `min-width` beating `max-width` in the
cascade is the point: on a screen too small for both, the row overhangs the
field rather than overlapping itself, which is the trade a phone already made.
All three parts are now individually red under mutation (drop the floor → the
shipped overlap test; drop the cap OR the published width → the containment
test).

**THE SAME PROXY WAS ONE LAYER DEEPER: a field dialog was clamped to the canvas's
WRAPPER, and its own comment claimed that was the field.** `showBubble` positions
in the wrap's offset coordinates — deliberately, because iOS can report
`documentElement.clientWidth` wider than the visible viewport — and its clamp
reads `wrap.clientWidth`. That IS the field on a phone and stops being it above
one: in portrait the board is height-limited, so at 768 the canvas is **504px
inside a 720px wrap and sits 108px in**. Measured, a tier-3 tower panel opened on
the rightmost pad overhung the board's right edge by **80px at 768 and 73px at
834**, out over the bare background, and `maxWidth` was being set to **704px
against a 504px field** — so the line `// The dialog can never be wider than the
field itself` was false exactly where it mattered. The ANCHOR was already correct
(`canvas.offsetLeft + worldToScreen(...)`); only the bounds were wrong. Third
instance in two days of *a quantity that correlates with the property until the
screen gets big*, after `wrapW >= viewport.width` and the control row.
**The first fix was a REGRESSION and the screenshot is what caught it.** Capping
`maxWidth` to the field as well looks like the tidy version, and on a 320x568
phone the board is only **224px** wide: the tier-3 panel went 304px → 208px and
its three branch cards broke into one-word columns ("one big / far shot / — most
/ of it is"). Fixing a tablet by cramping the smallest phone is the wrong trade,
so `maxWidth` stays on the WRAP (its job is "never run off SCREEN", and the wrap
is the on-screen bound) and only the POSITION prefers the field — **with a
fallback**: when the dialog is wider than the board there is nothing to prefer,
so it clamps to the wrap exactly as before. That fallback is what keeps every
phone byte-identical, and it is the same shape as the control row's floor one
entry up: prefer the tighter bound, but never let it squeeze.
**And I broke it mid-edit in the way `node --check` cannot see.** Replacing the
block deleted `const wrapW = wrap.clientWidth, wrapH = …` while the new code
still referenced them — a ReferenceError thrown inside `place()`, the same class
as the `w2s`-not-in-scope bug that once blanked the whole board. Syntax-checking
passed. What caught it instantly was the probe: `maxW: ""` (a style that was
never set) with every dialog pinned to the wrap's origin. **A measurement whose
numbers are ABSURD is diagnosing your edit, not the product** — read it before
re-reasoning about the feature.

**THE ONE SCREEN AN ENDLESS RUN EVER SHOWS YOU CARRIED NO DIAGNOSIS — and the
badge half was a real defect, silent in exactly the case where it was earned
honestly.** `showDefeat` builds its head as a ternary, and the post-mortem, the
run summary and the earned-badge line all sat inside the CAMPAIGN arm; both
other call sites passed `null, null` and wired no `guide` hook. So an endless or
daily defeat printed a score and stopped. That is backwards on every axis: an
endless run ends ONLY in defeat, so this is not one outcome screen of two but
the mode's whole feedback surface, and with no next level and no same-seed retry
the only way to do better is to build differently — which is precisely what
"what got past you" and "which towers carried" are for. Four things worth
keeping. (1) **The defect was `earnedHtml`, and the two award paths disagreed**
— the tell this file trusts most. `announce()` DEFERS a badge while the phase is
won/lost (so it lands in the outcome box rather than as a toast dimmed under the
scrim, an earlier audit's fix), `drainEarned()` hands the list to `showDefeat`,
and the endless arm dropped it on the floor. 🏃 Marathoner is the ONE badge whose
only award path is an endless run, so it was earned in total silence: no toast
because it was deferred, no line because it was discarded. Meanwhile QUITTING at
wave 20+ announced it perfectly, because `leavingPlay()` awards it while the
phase is explicitly NOT an outcome and `announce` then toasts — so the badge
appeared if you walked away and vanished if you played to the end. (2) **The fix
is a MOVE, not new code, and both helpers already guarded** (`summaryHtml`
returns "" on no rows, `earnedHtml` on an empty list), so lifting the three
blocks out of the ternary leaves the campaign byte-identical and needs nothing
mode-specific. `postMortem()` and `runSummary(false)` are already mode-agnostic:
the first reads recorded leaks and the towers on the board and guards its wave
lookup with `|| []`, the second reads engine state and correctly yields
`best: null` for endless, whose ids are strings and never in `save.bests` — the
headline already owns "🏆 New best!", so `false` is right and a `true` would
print it twice. (3) **A `guide` hook is not optional once a post-mortem
renders** — the 📖 button is drawn by the post-mortem block itself and the click
handler early-returns on a missing hook, so a call site that passes `pm` without
wiring `guide` renders a DEAD button, which is worse than offering none.
(4) **The coverage gap had a shape worth naming: a shipped test asserts
Marathoner is EARNED (it reads `__TD.ach()`), and nothing asserted the player is
ever told.** A test that proves a thing is recorded is not a test that it is
communicated — the same distance as "a scan proves a call site exists, only
driving it proves the call does anything", one layer out. The browser test now
drives an endless run to wave 20 on the pinned seed, SELLS the board so the run
can actually end (a maxed board survives past 400k ticks, so "play until you
die" is not a runnable fixture), and reads the defeat screen; the daily arm,
which would need a pinned calendar AND a 20-wave board, is covered by the
structural half instead, which is the standing pairing rather than a shortcut.
The fold is proven by SCROLLING the box and asking whether the quit button
arrived, never by `scrollHeight > clientHeight`, which a clipping box reports
identically.
(5) **And the fold clause needed TWO proxies
discarded, the second of which is new here: `overflow-y: hidden` is still
PROGRAMMATICALLY scrollable.** The known trap is that `scrollHeight >
clientHeight` is content OVERFLOW, which a clipping box reports identically to a
scrolling one — so this was written to scroll the box for real instead. The
mutation that makes the box CLIP then still PASSED, because setting `scrollTop`
works fine on an `overflow: hidden` box: the test could reach a button no PERSON
could. Rather than widen the tolerance, print what moved — the box genuinely
overflows at 320x480 (530 into 452) and short landscape (503 into 362), so the
clause was live, it was simply asserting the wrong actor. The honest property is
that a person can reach it: already in view, OR the box is USER-scrollable and
scrolling brings it in. It now fails naming exactly that ("it sits 466..522 of
480 unscrolled ... and the box is NOT user-scrollable"). Two of this session's
findings are now the same shape one level apart — assert the property, not a
quantity that correlates with it, and when a mutation passes, go and find what
actually moved. (6) **A dominated clause was written and DELETED, on a
measurement**: a "no call site may be handed `null, null`" check can never fail
on its own, because anything shaped that way also drops the panelled count
asserted above it — proven by a mutation that adds a fourth nulled call site and
still reports "only 3 of 4". A clause that cannot fail independently is
decoration, which this file has now deleted for the fourth time.
**A LOCKED LEVEL CARD PRICED ITS UNLOCK IN THE WRONG CURRENCY — and the code's
own comment shows the fix had already been made, on the other half of the same
card.** The visible label read **"win 8 ⭐"** while the rule two lines above it is
`beatenOn(save, selDiff, n - 1)` — beat the PREVIOUS LEVEL. Those are different
claims and they diverge on ordinary saves: 3★ + 3★ + 2★ is eight stars from three
levels, and level 9 stays shut while its card says you have paid. The
`aria-label` beside it already said the right thing — *"Level 9, locked. Win
level 8 to open it."* — under a comment reading *"9🔒win 8 ⭐ reads as nine,
locked, win eight star. Say the rule."* So somebody had seen exactly this defect,
corrected the SPOKEN name, and left the ink making the other claim: the `cheap`
class (an identifier or unit shipped as player copy) meeting the recurring
fix-it-where-you-found-it class, on one element. Both say `level` now, from the
one number, and the test asserts the ink and the accessible name name the SAME
level rather than checking either alone. Measured rather than eyeballed: the
widest label is a TWO-DIGIT one and every two-digit card ties, because the digits
are tabular — "win level 10" is 64px in a 142px card at 320, one line, card
heights byte-identical at 88px, no overflow at 320/390/834. Both mutations red —
restoring the stars label reports *saw "win 1 ⭐"*, and pointing the ink at a
different level reports *label says 2*.
**The same pass derived a cue law whose population was a hand-written SIX against
a table of TWENTY-FIVE** — so nineteen cues sat outside it, `buycharge` among
them, which is the very cue whose absence was the defect the law was written for.
`sfx()` is an if/else chain, so a name with no branch falls through and plays
NOTHING, and the mutation that renames the branch now reports exactly that.
Measured clean in both directions before the change (25 defined, 25 fired), so
this is coverage rather than a fix — the honest half to write down. Two
extraction subtleties are what make it derivable at all, and each is a false
result avoided: a cue can be raised through a TERNARY
(`sfx(e.shielded ? "shielded" : "leak")`), so a first-argument-literal scan
reports two live cues as dead; and a COMPARISON operand is not a cue
(`sfx(id === "drop" ? "splash" : "build")`), so the literals are taken only after
the comparisons are stripped, or `"drop"` is reported as a cue with no branch.
**And a tempting generalization was MEASURED and REFUSED.** The endless-defeat
defect was a call site missing a hook the UI can dispatch, so the obvious law is
"every `data-act` a dialog renders has a hook at every call site". Run over the
two dynamic-dispatch dialogs it reports `retrynew` MISSING on the endless and
daily call sites — and that is CORRECT code, because `showDefeat` renders that
button only for the campaign. Two of three call sites "fail" while being right,
and the honest version needs conditional-render analysis, so there is no clean
universal neighbour: the specific shipped clause (the `guide:` hook count equals
the call-site count) stays, and the general one is not built. The scan also
missed two hooks that were present until it was comment-stripped, because a
comment sitting between two hooks broke its preceding-character class — a scan
must not count, or be blinded by, its own documentation, for the eighth time.
**THE ⚙️ EXCHANGE HAD FOUR WELL-WRITTEN REFUSAL REASONS AND A DENY CUE, ALL OF
IT UNREACHABLE — because the button that would fire them was `disabled`.** The
handler already did the right thing: on a refused `buyCharge()` it plays
`sfx("deny")` and writes one of four strings to the shared hint line over the
field ("⚙️ Buy energy once the wave is walking", "⚙️ Only one extra energy per
wave", "⚙️ Your energy is already full", "⚙️ Not enough gold for another energy
(450🪙)"). But the HUD painted `charge.disabled = !r.ok` every frame, and a
disabled button dispatches no click — so that entire branch was dead code, and
every reason this control can give lived only in `title` (hover-only on a phone)
and `aria-label`. Verified rather than reasoned: a DOM `el.click()` on the
disabled chip fires nothing and `.td-abilhint` is never even created. It is the
documented `el.click()`-on-a-disabled-control law (the Worry Box's stranded
`[data-toy]`) meeting the `title`-is-a-hover-affordance law, on the resource
this file already records shipping as a bare unexplained numeral. Fixed with
`aria-disabled` plus the existing dim, so the tap reaches the handler and the
ENGINE stays the authority — the click still asks `buyCharge()`, which refuses
and hands back the reason.
Four things worth keeping. (1) **The shipped test's own COMMENT stated the
property its assertion did not.** It reads *"the refusal must be readable — not
a silent no-op, which is what a broken button looks like"* and then asserted
`title` and `aria-label`: a hover channel and an AT channel, on a game played
with a thumb. Re-pointed at the ink, which is what "readable" meant. (2)
**Playwright's actionability check treats `aria-disabled="true"` as not-enabled
and refuses to click it, while a real finger is unaffected** — so the test drives
a DOM `el.click()`, which is this suite's documented way to drive a tap anyway.
Worth knowing before concluding a control is unclickable because the harness
said so. (3) **The obvious mutation does NOT isolate the claim**: restoring
`disabled` also removes the aria attribute, so it fires the earlier
state clause. The faithful reproduction sets BOTH — correct ARIA, blocked
clicks — and then only the hint clause goes red, `saw ""`. Earlier-clause trap,
again. (4) **"What else has this shape?" was MEASURED, and the answer is
nothing** — the two neighbouring controls that also set `.disabled` beside a
refusal hint are both correct, for different reasons: an ability tile is not
disabled by affordability at all (it arms and hints), and ▶ CALL is disabled but
carries its reason as INK in its own label ("⏩ RUSH steady… · 6 left"), so its
unreachable hint is a redundant second channel rather than the only one. A
general "a control with a refusal hint must not be disabled" law would therefore
be a fence around one case; the specific behavioural test stays instead.
**A FIRST-EVER WIN REPORTED A RECORD THAT DID NOT EXIST — and the fix's own
justification was already written three lines above the bug.** The victory
screen's run summary rendered *"Best here: 16 stickers kept"* directly beneath
its own *"16 of 20 stickers kept safe"*: the same number twice, the second one
labelled as a historical best, on a save that had never cleared the level. The
cause is ordering, not arithmetic — `save.bests` is WRITTEN a few lines before
the summary is built, and the summary read the save, so by then the record it
asked for was this run. `pb` is correct and deliberately stays so ("New personal
best" fires only when you BEAT a record, and a first win beats nothing), which
is exactly why the fallback line ran and had nothing true to say. It fired on
every first clear: 40 levels x 3 ladders.
Three things worth keeping. (1) **The precedent was RIGHT THERE**: `wasBeaten`,
captured three lines earlier, carries the comment *"captured BEFORE the write
below, which is the only moment the question is answerable"* — the identical
shape, already solved, for the identical reason. One question captured before
the write and its sibling read after it is this file's most reliable tell, and
here both lived in the same twenty lines. `priorBestLives(st)` is now the one
owner, called before the write on the victory path and directly on the three
defeat paths, where nothing is written. (2) **Endless returns null
deliberately** — its record is WAVES, not lives, and the headline already owns
it, so a lives-based "best" there would be a second, wrong answer to a question
the screen has already answered. (3) **The separating input is the FIRST win,
and only it.** A run that is WORSE than a standing record reads identically
before and after the fix (nothing is written, so the save still holds the
prior), and a run that BEATS one shows the personal-best line instead — so a
test seeded with any existing record proves nothing. The clause that catches
it is a fresh save, and the mutation that restores the old read reports the
shipped string verbatim, *"Best here: 16 stickers kept"*. A second clause
seeds a HIGHER record and requires the line to quote 19 rather than the run's
16, which is what catches a summary reporting the current score.
One method note: the patch script asserted its anchor matched exactly once and
caught ME — `runSummary(false)` appeared five times, because two of them were
in the comments I had just written explaining the change. A scan must not count
its own documentation, now committed inside a patch script rather than a test,
and the assert is the only reason it was not applied to the wrong sites.
**ENDLESS'S RAMP CONSTANT DEFINES THE WHOLE MODE'S PACING AND WAS DEFENDED BY AN
INEQUALITY THAT PASSED FROM 1.05 TO 1.50.** Sweeping `DATA.ENDLESS` — the one
config surface never enumerated — found `growth` with a single read site and no
test naming it. The one assertion that touched it read `late > early * 2`, while
the declared 1.16 implies a 20-wave ratio of `growth^15` ≈ 9.3. Measured, that
bar is cleared by every growth from **1.05 (ratio 2.1) to 1.50 (ratio 407)**: it
ruled out "no escalation at all" and nothing else, on the number that decides how
fast endless escalates. Same class as `brittleBonus` — a test that proves a
multiplier EXISTS is not a test that it is the multiplier you declared — and the
same shape as `buildCountdownFirst`, a load-bearing constant nothing named.
Four things worth keeping. (1) **The window means make the expectation exact**:
`mean(g^15..g^19) / mean(g^0..g^4)` is `g^15` whatever the composition does, and
each window contains exactly one mini-boss wave, so they cannot skew against each
other. (2) **Comparing that ratio against `growth^15` READ FROM THE DATA is the
flattening trap, and the measurement proves it**: the quotient sits at 0.82-1.03
at EVERY growth from 1.10 to 1.22, so it is a genuine WIRING check and is
worthless as a magnitude one. The partner clause is therefore an ABSOLUTE band —
measured across 10 worlds x 7 seeds the shipped value spans 7.78..9.14, and
[6, 13] admits 1.14-1.18 while rejecting 1.13 (5.27..6.27) and 1.19
(11.61..13.27). (3) **The magnitude clause alone is satisfied by a generator that
ignores the field**, because at shipped data a hard-coded exponent is
indistinguishable — so the wiring half is SELF-PROVING: it moves `growth` to 1.10
at runtime and requires the ramp to follow, restoring in a `finally` because
`DATA` is shared. Its mutation reports the giveaway directly, "a smaller growth
must produce a smaller ramp (9.14 vs 7.78)" — the injected run measuring
identically to the shipped one. (4) **The third clause was checked for
DOMINANCE rather than assumed useful**: "the ramp must track the declared
exponent" could have been satisfied by the "smaller ramp" clause above it, so it
was proven independently by a generator that floors the exponent — smaller, and
at the wrong rate — which fires only the tracking clause at
`1.261..1.501 of growth^15`. A clause that cannot fail on its own is decoration,
and this file has deleted four of those; this one earns its place.
**A HAND-WRITTEN LIST OF HOSTILE SAVES SAID THE FORT WAS BULLETPROOF; DERIVING
THE LIST FOUND A REAL DEFECT IN ONE PASS.** The boot loader's coercions already
had a derived STRUCTURAL law — every field it coerces must also appear in
`freshSave()` — and that proves the coercion EXISTS while saying nothing about
whether it WORKS. The standing pairing, on the highest-recidivism defect class
in this codebase: a persisted field read without a default has crashed the fort
three times (`save.ach` on a legacy save, `save.stars` on the first win, and
`settings.music` inside the restore window, which is NESTED and structurally
invisible to a top-level derivation). My first probe was 14 hand-picked blobs
and reported 14/14 clean. Deriving the population from the loader itself — every
coerced field, wrong-typed — immediately failed on `midRun`.
**The defect: `midRun` was the one field coerced on KEY PRESENCE rather than on
shape** (`if (!("midRun" in save)) save.midRun = null`), so a hand-edited or
truncated 💾 Backup carrying `midRun: 7` — or even `{}` — is truthy and survives
boot. The fort home then rendered **"▶ Resume: ♾️ Endless · wave NaN ♾️"**:
a run that does not exist, showing NaN to the player, and mislabelled ENDLESS
because an absent `levelId` falls through to `runLabel`'s endless branch. The
banner's own code guards `lives` under a comment saying *"a field one short must
degrade"* — its two siblings never got the same treatment, which is the
fix-applied-where-it-was-found shape one more time, inside a single expression.
Three things worth keeping. (1) **The fix is SHAPE, and shape only, because that
is the half the banner reads** — `midRunShape` is the one owner, called at boot
and again in `resumeMidRun`, where the comment says plainly that the second call
is defence-in-depth (a checkpoint written during a session is well-formed by
construction), rather than implying both halves are load-bearing. The RANGE
checks stay in `resumeMidRun`, which is the only place that has the levelDef.
(2) **My first cut was a REGRESSION and a shipped test caught it**: nulling
`midRun` in memory left the junk in STORAGE, and the shipped clause *"the
unreadable checkpoint must be cleared, or the fort offers Resume for ever"* went
red. The user-visible property held — no banner — but the stored contract did
not, so the coercion now persists, and only when a checkpoint was actually
present so an ordinary boot writes nothing. When a correct-looking change turns
a shipped test red, read what the test was protecting before re-pointing it;
here it was protecting something real. (3) **The generic clause is the one worth
copying: no corrupt save may put NaN or "undefined" in front of the player.**
It is derived over every hostile case rather than aimed at this banner, and the
mutation that restores the key-presence coercion reports both symptoms by name.
**A DIALOG LANDED ON SCREEN AND ITS BUTTON DID NOT — the box-versus-contents
proxy, in the audit written to catch exactly this.** Running the one-pass
auditor after this session's three layout changes (the documented habit) found
💾 Backup's Done button at **241..333 on a 320px viewport**, 13px off the right
edge, with the dialog scrolling SIDEWAYS — which no other fort dialog does. The
cause is a flex subtlety worth keeping: `.td-overlay__row .td-btn` declares
`flex: 1`, and a flex item's automatic minimum is its CONTENT width, so
`flex: 1` could not actually shrink anything — three buttons held 92px each
against a ~246px content box. `min-width: 0` is what lets the declared flex
happen. Measured, the fix is scoped exactly where it was needed: 390 is
byte-identical, 360 now ALIGNS with the textarea instead of overhanging it by
12px, and 320 goes from overflowing to three 75px buttons, all above the 44px
adult floor. Wrapping was rejected on a documented law rather than taste — this
row's spacing is a `* + *` margin because flex `gap` is dropped on iOS 14.0, and
that pattern gives a wrapped row's first item a stray left margin and no
vertical gap at all.
**The guardrail lesson is the sharper half: `AUDIT: every fort overlay lands ON
SCREEN` measured only the BOX**, and here the box was a perfectly on-screen
13..307 while its child escaped to 333. A box landing on screen does not mean
its contents do — assert the property, not a quantity that correlates with it,
for the fourth time in this file. It now walks every control inside each dialog
and flags a sideways-scrolling box, both derived over the SAME opener list, so
a seventh dialog inherits them; the mutation that restores the shipped CSS
names both symptoms. The blast radius of the shared rule was enumerated rather
than assumed — six consumers, of which five are one- or two-button rows that
fit at 320 — and `UI.confirm` turns out not to use the row at all, so
`min-width: 0` can only change behaviour where a row would otherwise overflow.
**Three measurements from the same pass, recorded so they are not re-derived.**
(1) The 💰 sell button sits 8px from 🎯 targeting on the tower panel — the
fort's standard gap, both 48px tall, sell states its refund — so the
"destructive button beside a harmless one" worry is a design change, not a
defect, and is declined on the same grounds as this session's other two
rejected inventions. (2) **The daily defeat screen was covered only
structurally and is now verified behaviourally by hand**: a neglect run reaches
defeat in 2 waves and renders the post-mortem (4 rows) and the 📖 button, with
the run summary correctly ABSENT because a neglect run built nothing and
`summaryHtml` guards on empty rows. (3) **A CI heuristic in this file needs a
correction**: it records a `concurrency: pages` queue collapse as having "a
~2-minute duration", and measured here the evicted runs sat at **32-34 minutes**
— same mechanism (a pending run displaced by a newer push), but long because
each run takes ~35 minutes, so the duration test alone would read as a stall.
The reliable tell is that the cancelled commit is an ANCESTOR of a later
successful one, not its elapsed time.
**THE SNAPSHOT ROLLBACK RESTORES A *DIRTY* TREE, WHICH IS EXACTLY THE ONE CASE
`.claude/resync-main.sh` REFUSES TO HEAL — so it can never auto-recover this
image, and that is the hook working as designed rather than a bug in it.**
Observed three times in one session: the clone came back at a commit **23 behind
origin/main** with the SAME six files modified, and the second rollback also wiped
the `git stash` made during the first recovery. The hook fast-forwards only when
the tree is CLEAN and HEAD is an ancestor of origin/main, on the stated grounds
that "uncommitted work is the only thing the remote cannot restore" — a rule that
is right in general and cannot fire here, because the dirtiness is an artefact of
the IMAGE rather than real work. So the SessionStart warning is the whole of the
automation on this path, and recovery is manual every time. The safe sequence,
which is the part worth copying: back the diff up, then **prove the dirty files
are superseded before discarding them** — every added line the working tree held
that origin lacked was the PRE-FIX version of code fixed later the same session
(the old `win N ⭐` label, the old `wrapW` clamp comment, `charge.disabled =
!r.ok`, the campaign-only defeat ternary, `.td-btn { flex: 1 }` with no
`min-width`), which is a positive identification rather than an assumption — then
`git reset --hard origin/main` and verify by grepping for a fix you know shipped.
A telltale line is a better check than `git status`, for the reason this file
already records: on this runner a clean status is not evidence your work is
present. **Corollary, paid for twice: a `git stash` is NOT a backup here.** It
lives in the same `.git` the rollback replaces, so it vanishes with everything
else; only a PUSH is durable, and the practical consequence is to gate and push
each item as it finishes rather than batching several behind one gate.
**A measured NON-CHANGE, recorded so it is not re-derived or, worse, built:
naming the record an ENDLESS run is chasing.** A campaign HUD reads `wave 7/12`
and an endless one reads `wave 7 ♾️` — no total and no best — so the number the
run is scored against is invisible until the 🏆 banner fires on passing it, which
is the side-door shape (the cue arrives when the information stops being
actionable). It is still declined, on two grounds. The HUD is this project's
documented reflow-sensitive surface — its column widths were reserved to stop the
⚙️ hopping rows, and a star-goal readout was already rejected there for the same
reason — and, unlike the star goal, knowing your endless best changes NO decision:
you cannot play safe in endless, you build and survive, so it is motivation rather
than information. The honest alternative is the run label in the pause menu, which
has room and no reflow risk, and it was not built because the same "changes no
decision" objection applies. Measured while there: the HUD is stable at 320/360/
390/landscape across fresh, 5-digit gold, 24-life and two-wave-RUSH states — the ⚙️
sits at an identical y in all of them — so the reservation is holding.
**THE COUNT THAT ANSWERS "AM I NEARLY THROUGH THIS?" EXISTED AND WAS 11.5px IN A
CORNER — and the interesting half is that moving it cost a measured regression I
only found by looking at the picture.** `bodiesLeft()` has been on the CALL
button's meta line since the RUSH work, at 11.52px in a 71x14 box at the bottom
left, which is not where your eyes are while bodies are walking. Two homes were
ruled out by MEASUREMENT before the third was built: the HUD is already three
rows at every phone width with **34px free on the wave label's row at 320 and
360**, so a fifth readout forces a fourth row on the height-limited phones (320
has 384px of canvas — the documented reflow-sensitive surface, and the one whose
⚙️ once hopped between rows); and a per-enemy hp bar is already drawn for every
damaged body, so that candidate was already shipped. It goes in the
`.td-nextwave` pill, which floats at the top of the FIELD and — outside a build
phase or a RUSH window — was showing nothing at all, including for **the whole of
every endless run**, whose levels are not in `DATA.LEVELS` so there is no wave
table to preview.
**Then the screenshot showed it sitting on the incoming bodies, and the numbers
said the same thing.** Joined onto the preview's line the pill goes 144 -> 212px
of a 378px canvas and covers a lane's first cells on **9 maps at 390 and 16 at
320, against the shipped 1 and 7** — i.e. one line of new text undid the entire
anchor system that exists to keep this pill off the road. Four layouts were
measured against the same texts: one line 9/16, one line at a smaller font 1/16
(the narrow media query already shrinks it, so there is nothing left to give at
320), count-only 0/1 (best, but it deletes the shipped RUSH preview, which is a
regression), and **stacked on its own line 1/8** — the +1 at 320 being pure
height. Tightening the split pill's `line-height` to **1.12** takes it to
**1/7/1, the byte-identical map LISTS** (L7 · L7,10,12,19,31,32,35 · L19), so
1.12 is a measured constant and not a taste. Stacked, the pill is never WIDER
than the preview it already showed, which is the property the test pins: same
level, same tick, same preview, with the count line and without it — zero maps
differ. Three smaller things worth keeping. **The value must come from the ENGINE
and be read ONCE**: most of a fresh wave is still QUEUED, so a UI-side
`state.enemies` tally reads 1 where the engine says 6 (the mutation prints
exactly that), and two `bodiesLeft()` calls would be two answers whenever a kill
lands between them — the CALL meta and the pill now share one hoisted read, with
a structural scan pinning the count at one. **The anchor key takes the count's
DIGIT COUNT and never its value** (the pill is `tabular-nums`, so 23 and 22 are
the same width): measured over one wave of a maxed L12 board that is **3 keys
against 19 distinct texts**, where keying on the text re-derives the corner on
every kill and the pill hops sides while you watch. And **a readout that changes
on every kill must not be a live region** — the pill is `aria-live="polite"` for
the preview, so it drops to `off` while a count is showing and a screen reader
is not announced at on every death.
**Two things fell out of the mutations rather than the design.** Hiding the pill
left STALE TEXT in its spans — a hidden element holding last frame's message is
the `.win-hero` class, and it surfaced as a mutation firing the WRONG clause
because the probe read a preview hidden three levels earlier; the hide path
clears them now. And a shipped clause asserted `nw.hidden` as a proxy for "no
preview", which was the same thing only while the preview was the pill's sole
occupant — **when a check asserts X, assert X**, so it reads the preview span and
the pill's own visibility is pinned as a second clause.

**ENUMERATING THE ENEMY'S OWN TIMED STATES AGAINST THE RENDERER FOUND TWO
MECHANICS WITH NO PICTURE — one of them the campaign FINALE's entire kit.** The
method is the export/hook enumeration this file already records, applied one
level down: `<name>Until` is this engine's convention for a timed mark, so the
population derives. Eleven exist; **eight are drawn and three were not.**
(1) **`brittleUntil` had ZERO references in the whole of `td-render.js`**, so
❄️ Blizzard Cone's 300-gold headline — *"chilled bodies take extra damage"* — was
a sentence on a card and nothing on the field. That is the exact sibling of the
defect 🎯 Rust Ray's own cue was written for, and the comment beside that cue
states the reasoning in as many words (*"which bodies are currently soft is the
entire reason to own a Rust Ray"*) while the neighbouring case went unwritten.
It cannot ride the frost tint: EVERY fan tier slows, so a tint means "slowed"
and says nothing about brittle, and the states genuinely diverge — a slow lasts
0.5s against the brittle mark's 3s, so a body that walks out of the cone stays
soft for seconds with the tint already gone. (2) **`hurriedUntil` was the louder
omission**: three mechanics write it — 📻 Boom Box's aura, 🛢️ Oil Drum's slick,
and 🎁 The Big Present, *whose whole design is that it never hits you and makes
the party ARRIVE FASTER* — so the campaign's own finale did its one trick
invisibly. You could see your Fan working and could not see the same thing being
done back to you. (3) **`stunnedUntil` looked like the third and is NOT**, and
checking rather than assuming is the point: it is only ever set while the body is
`blockedBy` a soldier, so a drawn RC car is standing on top of it, and the engine
already emits a `stun` event the renderer bursts as stars. A second persistent
mark there would be the near-duplicate paint this project has twice deleted.
Four things worth keeping. **The shape carries the meaning, not a fourth colour**
— a filled disc is the slow, a broken ring AROUND is the armour strip, so brittle
gets FRACTURES ON the body and hurry a CHEVRON TRAIL BEHIND it, which is what
keeps four states apart at a 27px cell. **A white mark on this roster is the
documented hit-flash failure**, so both cues are drawn twice, dark under bright —
but the FIRST version of that claim was wrong and a passing mutation is what
caught it. I wrote that a white mark alone "vanishes" on a pale body, citing
101px against 171; those two numbers changed the radius AND added the second
pass, so the gain was attributed to one of two variables. Measured properly at a
fixed radius the backing is worth 56.0 → 63.1 mean per-pixel delta on the palest
body, which is not a vanishing. What it actually buys is UNIFORMITY — white-only
reads **1.51× stronger on a knight than on a sock** (84.8 vs 56.0) against
**1.17×** with the backing — i.e. one cue that works the same on every body
rather than one that is loud on the dark half of the roster and faint on the pale
half. A pixel COUNT cannot see this at all (it is pure geometry: 171 on all four
bodies tested, identical), which is exactly why the mutation that removed the
backing passed; the metric had to become MAGNITUDE before the claim was
falsifiable. The same double-pass reasoning took a flat hurry tick from 65px to a
chevron's 235. **The trail asks
the ENGINE where the body was** (`posOn` along its own lane) rather than guessing
a screen direction, because the floor rotates 90° in portrait and a guessed vector
points sideways there. And **the cost was measured, not assumed** (the TD-6 rule):
interleaved medians over a 160-body board with EVERY body simultaneously brittle
and hurried — a state that cannot occur — read 2.83 → 4.70 ms against a 16.7 ms
budget, so no optimisation shipped.
**Two test lessons, and the second cost a clause.** The self-verifying control
("two identical draws must be identical") caught a **4px** drift immediately —
`draw()` ages every screen fx by one and seeds the lerp's `prevPos`, so the first
frame after a state swap is not the same picture as the second — which is small
enough to look like a passing control and big enough to be mistaken for a cue;
the fixture settles with three draws now. And a `hurried vs brittle` clause was
written and then **DELETED as unfalsifiable**: the two cues differ in COLOUR as
well as placement, so a pixel diff clears any sane bar even when the geometry is
made identical — proven by a mutation that draws the chevrons ON the body at the
fracture radius and still passes. "Four states, four readable pictures" is not
something a pixel count can express, and a clause that cannot fail is worse than
none.

**THE SNAPSHOT ROLLBACK TOOK A WHOLE SESSION'S WORK MID-GATE, AND THE RECOVERY
IS ONLY CHEAP BECAUSE THE PATCHES WERE PRINTED INTO THE CONVERSATION.** This
file already records the mechanism (the writable disk is restored from a pinned
image, so the repo and `/tmp` die together) and the rule (only a PUSH is
durable). What this instance adds is the SHAPE of the damage and the drill.
The clone came back at a commit **24 behind `origin/main`**, carrying **six
uncommitted files that were not mine** — a much older session's work, including
two files this session never touched — while `git status` read perfectly
normally. A full `npm test` had just gone **840/840 green on a tree that no
longer existed**, which is the worst possible signal: a verdict about nothing.
**The drill, in order, and every step earned its place.** (1) **Do not trust the
dirty files.** Verify before discarding: extract every substantive added line
from `git diff` and `git grep` each one in `origin/main`. Here **170 of 171 were
already upstream** and the one that was not turned out to be an export list that
`origin/main` had a strict SUPERSET of — so the tree was provably superseded and
nothing was lost by resetting. A sample is not enough; the one line that
differed was in the last 30. (2) **Check what survived before re-deriving.**
Grep the working tree for a marker from each change; here all six files came
back clean, and the scratchpad had rolled back to the same date, so the patch
scripts were gone too. (3) **Reset to `origin/main` and re-apply from the
TRANSCRIPT**, which is the only store the restore cannot reach — this is the
real argument for pasting patch bodies into the conversation rather than only
into a scratch file. (4) **Re-verify targeted before re-running the 25-minute
gate**, so a faithful re-application is confirmed in a minute rather than
assumed. (5) **Check the remote is where you think it is**: CI run #410 on
`origin/main` was green, which is what established that the ONLY unshipped work
was the part being re-applied.
Two corollaries. **A local commit is not a backup here** — the restore replaces
the whole `.git` — so the exposure window is "gate start" to "push landed", and
the right response is to push the moment it goes green rather than batching a
report first. And **the SessionStart hook cannot save this image**: it heals a
clone that is strictly BEHIND with a CLEAN tree, and the restored snapshot is
behind AND dirty, which it correctly refuses to touch.

**THE AIMING DECISION HAD NO PICTURE — and building its test hit FIVE fixture
traps in a row, every one of which produced a confident wrong answer.**
`AUDIT targeting is a LIVE lever` measures the best 🎯 mode at 4-9 lives on a
boss finale with a different winner per level, and the only thing the game ever
showed was the mode's NAME — while *"first"* (furthest along the lane) against
*"close"* (nearest the gun) is exactly the pair a name cannot settle. All three
shooting lines have kept `t.targetId` current every tick since the P6 work and
only the Fan's beam drew it, so the answer sat in the state and never on the
field. A selected tower now dashes a line to the body it has chosen, in the
range ring's own blue (same selection language, no new colour on a field that
already carries four body states), read off `lerped` so it lands on the
interpolated position rather than stuttering against a smoothed sprite.
**The five traps, in the order they fired.** (1) **Bodies placed by guess were
out of range** — `pads[0]` with bodies at dist 3 and 5 reported `both 0`, and
the fixture precondition is the only reason that read as a broken FIXTURE rather
than a broken feature. The pad and the two lane points are DERIVED now: walk
every pad, keep the one with the widest in-range window, then take the point
furthest ALONG and the point nearest the GUN. (2) **Most pads cannot separate the
two modes at all** — this level's typical window is 3 cells and the lane arcs
around the pad so both ends sit the SAME distance from it; only one pad of eight
has a 7-cell window, which is why the choice has to be derived rather than
picked. (3) **`tick()` returns early in the BUILD phase**, so the targeting code
never ran and every mode still reported 0 — the trap this file already records
from the Sparkler, met again; the fixture calls a wave and now ASSERTS the phase.
(4) **A live wave leaves fx ageing**, so the three-draw settle that works on a
paused board read 6986px between two identical captures; it ages the board empty
first. (5) **And the isolation was wrong in two ways at once, which all three
mutations passed**: comparing *no selection* against *selected* measures the
RANGE RING, which selection has always drawn, and the two mode captures had a
TICK between them, so that diff measured the whole board moving. Both captures
now share one selection and one state with no tick, so the only thing that can
differ is the line.
**The claim is deliberately split in two, and that is what makes it end-to-end
without constructing its own answer**: the ENGINE half asserts the two modes
really pick different bodies (which is the producer, separately covered by the
targeting audit), and the RENDER half asserts the line follows whatever
`targetId` says. A single test that set the mode and looked at pixels would have
been measuring a tick; a single test that set `targetId` and looked at pixels
cannot see the producer break. Two clauses, one chain.

**THE MOST EXPENSIVE CONTROL IN THE GAME PREVIEWED NOTHING — and the engine's own
comment had been describing the missing feature all along.** Every other armed or
aimed control in the fort shows its reach: a selected camp draws its rally range,
a build ghost draws the tower's. 🧨 Toy Box Drop costs 130 gold, two ⚙️ and a
cooldown, lands a 2.4-cell blast, and drew **nothing** — the renderer had ZERO
references to an armed ability, so a point power was aimed from a number in the
Toybox Guide. `abilityRadius()`'s own comment says it is read once "so the blast,
the reveal, the puddle **and the ring the player sees**" agree; there was no ring.
**When a comment describes a thing you cannot find, check whether it was ever
built.**
**Additive by construction, which is what makes it safe.** The power still fires
on `click` exactly as before — the ring is a SEPARATE `pointerdown` /
`pointermove` / `pointerup` listener that only draws. Nothing about WHEN a tap
resolves changed, a plain tap is still a plain tap, and the toddler-chaos
guardrails drive `el.click()`, which dispatches no pointer events at all, so they
are untouched. The radius is asked of the engine (`abilityRadiusOf`) and never
read from `DATA.ABILITIES`, because 💣 Wider Blast moves it and a ring the engine
will not honour is worse than no ring — the sell-refund defect with a radius
instead of a price, and its mutation reports `drew 2.4, engine says 3`.
**Two of six mutations PASSED, and each named a clause testing a NEIGHBOURING
branch under this one's name.** (1) *"The ring goes when the finger does"*
survived deleting every `pointerup`/`cancel`/`leave` listener — because resolving
the power CLEARS the ring itself, so the clause only ever exercised the FIRE
path. Those listeners exist for the ABORT path: press, change your mind, release
OFF the field, where no click lands and nothing else can clean up. The separating
input is a drag that leaves the canvas. (2) *"An instant power draws no ring"*
survived deleting the radius guard — because 📣 Rally Horn is INSTANT: its tile
fires on the spot and never arms, so `abilArmId` stays null and the guard is
never reached. Measured, three of four tiles arm (`drop`, `sticky`, `overclock`)
and the horn does not, so ⚡ **Overclock** — which arms, waits for a TOWER tap and
has no radius — is the one input that reaches the guard with nothing to draw.
**And the screenshot lied three times before it told the truth**, which nearly
became a bug hunt: the ring measured **13,663 changed pixels** in a canvas diff
while three successive screenshots showed empty floor. The cause was my CROP, not
the feature — in portrait the floor is rotated, so `screen_y = world_x × cell`,
and a ring parked at world x=20 sits 540px down a canvas I was cropping at 400.
**When a pixel diff and a screenshot disagree, believe the diff and check the
crop.**
**The first version of the test then named TWO powers, which is this file's
most-repeated failure written by the person who keeps writing it down.**
`fieldAim` has no per-id branching, so the rule is a property of the ability's
KIND — a point power gets a ring, anything else does not — and a clause that
drives 🧨 and ⚡ is a two-item hand list, not that property. It walks the strip
now and holds every tile to the rule, with a floor asserting both kinds were
actually offered (a derivation fails OPEN, and an empty walk would pass
silently). The mutation that matters is the one the hand list could never
catch: restricting the ring to `drop` alone leaves 🧨 and ⚡ both correct and is
caught on **🍯 Sticky**.

**A VISUAL PASS AT A SIZE NOTHING LOOKS AT FOUND THE ANCHOR SCORING POSITIONS
THE PILL NEVER TAKES — at every width, and worst on the narrowest phone.** The
fort's battlefield had been screenshotted at 390 and 320; TABLET portrait had
only ever been reached by NUMBER audits (the portrait law, the pad-burial
sweep). Looking at it found nothing wrong with the picture — all four body-state
cues, the aim line and the aiming ring render correctly at cell 39, no overflow,
no page errors at 390 / 768 / 834 / 1024x768 — but measuring the pill's box did.
`UI.anchorPreview` computes its three candidate SPANS from `cv.clientWidth`,
while the CSS positions the pill against its offsetParent, the canvas WRAP. The
two differ by however far the canvas is inset, and that is not a rounding error:
**48px at 320 (21% of a 224px field), 36 in a narrow landscape, 87 at 834 and
108 at 768.** So every span was judged at a place the pill would not land. This
engine's two-coordinate-space trap — recorded six times in the ENGINE — showing
up in the LAYOUT layer.
**And the fix already existed, twenty lines away, for the OTHER thing that floats
over the field.** `showBubble`'s clamp was corrected for exactly this in an
earlier pass and its comment states the identical measurement — *"at 768 the
canvas is 504px inside a 720px wrap and sits 108px in … a tier-3 panel overhung
the field's right edge by 80px at 768 and 73px at 834"* — so the panel prefers
the FIELD's box and falls back to the wrap only when it cannot fit. The pill's
anchor is the sibling nobody asked about, which is this project's most repeated
shape: a fix recorded as a one-off instead of asked *what else has this?* When a
comment in one function names a layout inset in pixels, grep for every other
element positioned in the same parent.
Scoring in the space the pill is actually positioned in takes the measured
budgets to **390: 1 (unchanged) · 320: 7 → 3 · narrow landscape: 1 (unchanged) ·
768 and 834: 0** — a real improvement exactly where the pill has least room to
move, and no regression anywhere. The mutation that restores canvas-space
scoring reports the old seven maps by name.
Three things worth keeping. **The tablet sizes EARN their place in that test by
the rule that rejected two landscape sizes from it**: a size is only worth
pinning if it can SEPARATE the two states, and fixed-centre vs anchored measures
9 vs 0 at 768 — a wider gap than the phone's 10 vs 1 — because the cell grows
with the viewport, so the pill covers more lane at the centre and has more room
to dodge to. **A clean visual result is still a result**: the pass is written up
even though the picture was fine, because that closes the question rather than
leaving it to be re-asked. And **one half of the fix is deliberately unproven and
says so in the comment**: `cv.offsetLeft` versus assuming the canvas is centred
measures IDENTICAL at every shipped width, so a mutation swapping them passes —
it is the expression that stays correct if the canvas ever stops being centred,
not a distinction any clause can fail on. Saying which half is vacuous beats
implying two protections where there is one.
**The four body cues were then checked under simulated colour blindness, and the
result is clean for the reason the design intended.** The roster's own CVD sweep
already concluded that hue was never doing the separating work and the silhouette
law was; the same question applies to four state marks that sit ON the bodies.
Measured with LMS simulation over deuteranopia, protanopia and tritanopia, the
CLOSEST pair (strip vs brittle) moves 262 → 254 changed pixels and the faintest
cue against a plain body (strip) 116 → 106 — i.e. at most a 9% loss, because a
filled disc, a broken ring AROUND, fractures ON and a chevron trail BEHIND are
four different SHAPES rather than four hues. **No guardrail was added, and that
is the point of measuring rather than asserting**: the shipped clauses already
require each cue to clear 120 under normal vision, CVD costs under a tenth of
that, so a CVD clause would fire on exactly the same mutations and is the
near-duplicate this project calls noise rather than coverage.

**THE RANGE RING DREW A SHAPE THE MORTAR DOES NOT HAVE — a filled DISC where the
truth is an ANNULUS — and the honest figure printed two lines below it on the
same panel was already computed from the very number the picture was missing.**
The Mortar is the only line with a minimum range (1.5 cells at every tier and
both branches; a derived guardrail already pinned that it declares one
everywhere), and nothing on the field has ever drawn the hole under the tube.
Measured across the campaign: **152 of 501 pads lose lane coverage to that dead
zone, 15 of them lose ≥30% of what the disc implies, worst L15/p4 at 47%** —
while `% road`, which sits on the same tower panel, is computed by
`laneCoverage(levelDef, cx, cy, reach, dead)` and has always told the truth. So
a player reading the number got 13% and a player reading the picture saw a solid
blue disc over the lane. Two surfaces on one panel disagreeing is this project's
most reliable tell, and this time the PICTURE was the wrong one. It is the
recorded *"a ring that understates reach is worse than no ring — it IS the
placement cue, and it was lying"* finding, one radius over and pointing the other
way: this one overstated, which is the direction that costs you the tower.
**The value existed and the ACCESSOR threw it away**, which is why no surface
could ask for it: `reachInfo` has always returned `{ reach, dead }`, `coverageOf`
reads both, and `towerReach`/`reachAt` each did `return r.reach` and dropped the
other half. `towerDead` is the missing half of the same owner, never a second
computation — the ask-the-engine law that already fixed the sell refund, the
per-wave charge and the panel's own stat line. It also gives 🎯 **Close Quarters**
its first visible effect anywhere: a 3⭐ node whose entire mechanic is shrinking
this radius by 40%, previously invisible on the field.
Three implementation notes. **The hole is a default-noop**: the tint is filled as
one path with the outer arc clockwise and the inner anticlockwise, so non-zero
winding punches it — and with `dead: 0` the second arc is never added and every
other line's ring is byte-identical to the disc it replaces. **`setLineDash`
mutates shared canvas state**, which is exactly how a decorative overlay once
aborted the whole frame (the Tail Wind `w2s` slip), so the dashed inner rim is
set inside a `save()`/`restore()` **and** cleared explicitly. And **the dead zone
deliberately does NOT take the ⚡ pad boost or the 🧊 Tail Wind multiplier** —
`reachInfo`'s own comment says the engine's mortar call passes `rangeMin` raw and
wraps only the max, so scaling it here would make this surface disagree with the
engine about the one thing it exists to report.
Four testing notes. **`place` is `(lineId, padId)`** — the argument ORDER, not
just the pad-id trap, and a swapped pair returns `{ ok: false }` leaving both
towers `undefined`, which presents as a broken engine. **The metric is the ring's
OWN CONTRIBUTION** — the same eight points drawn with the selection off and on,
so the floor, the props and the tower sprite all cancel and only the tint is
left; a raw sample would be reading the floor. **The bar is a measured
SEPARATION, not a slack**: the shipped hole reads exactly 0 and the disc it
replaces reads 292 at the same points. And **the control clause is what stops the
claim passing vacuously** — a dart's ring must reach its own feet, or "the ring
does not paint near a tower at all" would satisfy the hole clause; it is
mutation-proven separately by giving every ring a hole, which reports
`a dart has no dead zone, so its ring must reach its own feet (got 0)`. The
engine clause asserts against DATA's raw `rangeMin` rather than against
`mods.mortarMinMul`, because deriving the expectation from the mod under test is
the flattening trap, and its non-flattening partner is that the ⭐ node must
genuinely move the number.

**A LIVE RUN WENT RED ON FIVE ASSERTIONS THAT ALL SAID 华丽 HAD 20 GAMES INSTEAD
OF 40, AND NOT ONE OF THEM NAMED A SCRIPT.** Run #415's `verify-live` failed
5 of 841 — a category screen with too few tiles, her world registering 20, her
book rendering 20 slots, 诗词's screen never appearing, her sticker meter
stopping at 20 — while `test` and `deploy` were both green and the site was
serving the right commit. One cause: her 40 games live in TWO files, and
`games-hl-a.js` never arrived from the CDN edge. **`page.goto` resolves on
`load`, and a `<script defer>` whose fetch failed fires no error anybody is
listening for**, so the page boots complete-looking with that file's globals
simply absent and the suite reports the downstream symptoms. Reproduced exactly
by routing that one file to `abort()`: her count is 20, the same number the live
run printed. This is the run-#365 transport class one layer DOWN — there the
navigation itself was reset and a retry was shipped for it; here the navigation
SUCCEEDS and a sub-resource is what went missing.
**The deploy's own pre-flight is not the answer and was not at fault.** It
already fetches every `?v=<sha>` asset and requires a 200 before the browser
starts — it passed in 2 seconds, seconds before the browser missed the file —
because curl and Playwright open different connections to different edges. A
pre-flight can only prove the file was servable *then, there*.
So the check lives where the retry already does: **wrap the BROWSER, not the
call sites**, in the same `withNavRetries` owner, because there are 14 `goto`s
across four files and six places that build a page. After a successful `goto`,
any same-origin `<script src>` with no Resource Timing entry carrying a decoded
body is treated as the transport shape it is — retried, announced, and on
exhaustion thrown as `the page loaded but these scripts did not run:
scripts/games-hl-a.js`. The script list is DERIVED from the page's own tags, the
size is read as `decodedBodySize` (cache hits still report it, so a warm load is
not a false positive), and a page that cannot be asked at all — a closed context,
or the fake pages the retry harness itself uses — is treated as "nothing to
report" rather than as a failure. Measured on the real page: 26 scripts, 0
reported missing.
**And the guard that decides whether this is safe to ship at all is the FAILURE
DIRECTION.** Resource Timing body sizes are an engine feature, and WebKit is not
installed in the dev sandbox — so "it works in Chromium" says nothing about the
browser CI actually runs `verify-live` against. If nothing at all reports a body,
the mechanism is unavailable and the check goes SILENT rather than flagging
everything; the mutation that removes that one clause reports **all 26 scripts
missing** and would have failed every run three retries deep. A check whose
unavailable-API behaviour is "flag everything" is the false-positive machine this
file keeps refusing, and the only way to know which way it falls is to simulate
the engine that lacks it.
Four testing notes. **The two halves need different fixtures and both are
required**: a fake page proves the POLICY (does it retry, does it stop, does it
name the file) and cannot tell you whether the DOM read works, so the DETECTION
is proven separately in a real browser by blocking that exact file — with the
fixture self-verifying, since it asserts the block really does reproduce the
live symptom. **A mutation that alters nothing proves nothing, for the second
time in this file**: raising the loop's `for` cap passed, because the `break`
bounds the loop independently — and raising the `break` passed too, because the
`for` cap does. It is an outcome TWO guards deliver, so only removing BOTH turns
it red, and the test now says so instead of implying one protection. **And that
same redundancy is why the fixture needs a RUNAWAY counter**: this fake page's
`goto` always SUCCEEDS, so with both bounds gone the loop spins for ever and the
test HANGS rather than fails — a hang reads as broken infrastructure, which is
worse than a red. With RUNAWAY it reports `retried past any sane bound`. Finally,
**`const H = require("./helpers.js")` is scoped to the test that declares it** —
the fourth instance of the alias trap, after `const L = global.TDLogic` inside
the guide function.

**THE WAVE'S REMAINING-BODY COUNT WAS RENDERED TWICE, AND THE COPY NOBODY NEEDED
WAS BREAKING THE NUMBER AWAY FROM ITS UNIT ON EVERY PHONE.** It shipped on the
field pill AND on the ⏩ RUSH button's meta line, deliberately — the test's own
comment defended the pair on the grounds that both read ONE hoisted
`bodiesLeft()` so they cannot disagree by a frame. What that reasoning never
checked was how the second one RENDERS. Measured with a `Range` per character,
`steady… · 18 left` wraps **between the number and its unit at 320, 360, 390 AND
414** — every portrait width drew `steady… · 18` above an orphaned `left`, while
the identical fact sat large and unbroken in the pill 700px up the screen. Only
landscape happened to break in a sensible place. So the button now states its own
offer or refusal and nothing else, which is what a button's meta line is for;
it drops from two lines to one (74.6 → 62.6px at 390), and in portrait a shorter
control is a bigger battlefield.
**Two shipped tests encoded the duplication and were RE-POINTED rather than
deleted**, because their real claims are about the COUNT and not about which
surface carries it: that it includes the still-QUEUED half of a fresh wave (a
readout built from `state.enemies` understates every wave at exactly the moment
you look), that it drains monotonically, and that it reaches 0 exactly when the
phase ends. They read the pill now, and each gained the clause that keeps the
duplicate from coming back — the button must not repeat it.
**The interesting consequence was the third test.** `QoL: the CALL button
reserves its tallest line` measured a hand-written list of strings, and three of
them were `· N left` variants the UI can no longer emit — leaving them would have
been exactly the *"a string nothing can emit is not an upper bound, it is an
arbitrary monster"* trap its own comment warns about. Derived from `RULES` now
(the bonus bounded by the first countdown × the rate × ⏩ Early Bird's 1.5, the
clock by that countdown, the refusal by `maxWavesInFlight`). And deriving it made
the test's own non-vacuity clause FIRE: **with the count gone, no emittable
string wraps at 320 at all**, because the meta drops to 0.62rem there, so no
reservation can be exercised at that width. The clause is now asserted over the
WHOLE sweep instead of per width, and the comment says which size actually binds
— landscape, where the control column is a narrow gutter.
**And the method note is the sharpest thing here: my own probe disagreed with a
shipped green test, and the PROBE was wrong.** Measuring with a fresh browser
context per viewport reported the button at 63/65/77 across strings, i.e. a
reservation that was not binding at all; measuring the way the test does — one
page, `setViewportSize` — reports a uniform 57/57/65. I nearly wrote up a
regression on the strength of the first number. **When a probe contradicts a
green test, reproduce the test's exact method before believing the probe.**
Two tooling lessons, both about a failure surviving. **A mutation loop killed by
a tool timeout STRANDS its mutation** — this file already records that for
`git stash`; here it was `cp`, the 10-minute cap fired between the mutation and
its restore, and `tests/td.test.js` sat mutated in a clean-looking tree. Run
mutations in the background so they cannot be truncated, and put the restore in a
`trap ... EXIT TERM INT` so a kill still restores. **And a fixture owns its
cleanup EVEN WHEN IT FAILS**: this test changes the VIEWPORT and restored it on
the happy path only, so every failure inside it left the page in landscape and
took the next test down with it — observed twice while mutation-testing, both
times surfacing as `selecting a camp must draw its reach ring`, which has nothing
to do with it. Moved into a `finally`, and proven: the same mutation now reports
`# fail 1` where it used to report 2.

**THE RING NOW DREW A HOLE AND NOTHING IN THE GAME SAID WHAT IT MEANT — the ⚙️
mistake one commit after shipping the picture.** The Mortar's dead zone is the
single structural fact behind the documented mortar-mono loss (a tube cannot fire
at what is under it, so a mortar hugging the lane leaks whatever walks beneath),
and the ONLY player-facing mention of it anywhere was 🤏 Close Quarters'
description inside a ⭐ tree you may never open. The 📖 Toybox Guide has a tower
section whose whole job is "what each toy does", and it did not say it. Now it
does, DERIVED from `tiers[0].rangeMin`, so a second line with a minimum range
documents itself.
**And the same sentence was carrying a hand-written line list.** "cannot hit
fliers" read `k === "mortar" || k === "camp"` — while `hitsFliers` is a real data
field that `reachedBy` already derives from, and the truth "exactly two lines
reach air" is separately guardrailed. A fifth line would have been silently
promised air it cannot reach, in the manual, which is the population-by-hand
failure this file records more often than any other. It reads `!T[k].hitsFliers`
now.
**The guardrail is SELF-PROVING rather than a restatement**: it injects a fifth
tower line at runtime carrying `hitsFliers: false` and `rangeMin: 2.5`, opens the
real guide, and reads its row off the rendered page. A hand-written list
structurally cannot serve that line and a hard-coded 1.5 cannot either — both
mutations report the exact wrong sentence, `Test Catapult — splash (110🪙)` with
no flier warning, and `… nothing within 1.5 cells` on a line whose data says 2.5.
The Dart is the control that stops the clauses passing on a row that says both
things about everything. One fixture note: the first cut opened the guide with
`[data-act="guide"]`, which is the PAUSE MENU's selector — the fort home's is
`.td-guide-open`, and a selector borrowed from the wrong surface fails as
`Cannot read properties of null`, which reads like a broken feature rather than a
broken probe.

**FOUR IN-GAME CUES WERE PROPOSED, MEASURED AND REJECTED IN ONE PASS — recorded
because each one is the obvious next idea and each has a number against it.**
(1) **"This body is past every gun" cannot fire on a board worth playing.** The
engine knows the furthest lane point any tower covers, so a body beyond it can
never be hit again — which sounds like the perfect in-wave cue, and is the one
moment a 130🪙 🧨 earns its price. Driven headless over four boss finales × 8
waves on a full tier-3 board: **0 of 2964 sampled frames had a single unhittable
body.** The maps' pads genuinely hug the whole lane, exactly as the wave
generator's own comment claims, so the state effectively does not arise once you
have built. Its proxy measures the same way from the other side: the lane beyond
the last gun is **5.8% at full build (3 of 40 levels above 20%) and 30.1% on a
3-tower board (16 of 40 above 20%)** — so a lane TINT would be loud at wave 1,
when it tells you only that you have built two towers, and silent afterwards.
The spread runs smoothly from 0% to 49% with no separation anywhere, so any
threshold would be invented. (2) **A board-level "% road" total is decoration.**
The per-pad figure is deliberately a stable property of the PAD, comparable
across a level; an aggregate would read 60-95% for the whole run with no decision
attached, which is the ever-present badge this project already refuses. Measured
alongside it: a pad's own figure is a fair proxy for what it ADDS to the board —
mean delta/solo **0.831** on a half-built board — though 10 of 72 pads add under
half what they read and 4 add under a fifth (worst: a pad reading 7% that adds
0%). Not enough to trade a stable number for a board-dependent one that moves
whenever you build elsewhere. (3) **A per-LINE build ghost is hidden at the
moment it would matter.** The ring drawn when you tap an empty pad is a tier-1
DART's, which understates the mortar by a whole cell — the same
ring-that-lies class just fixed for built towers. But screenshotting it shows the
build MENU sits over the pad it belongs to, so a line-specific ring would be
occluded exactly when you are choosing; and each card already carries its own
honest `% road`. (4) **The refusal surface is COMPLETE.** Enumerating every
`{ ok: false, reason }` the engine can return gives 20 reasons; 13 are
unreachable from the UI by construction (a built pad opens the tower panel rather
than the build menu, the lever button only exists on fork levels, the strip only
shows equipped powers, an outcome overlay covers the field), and every one of the
seven a player can actually hit names itself on screen. One scan note, for the
umpteenth time: the first sweep searched for `"reason"` as a quoted string and
reported `full` and `charge` as unexplained — they are keys in the ⚙️ button's
own `why` map, written `full:` without quotes. **A scan's own pattern is part of
the scan**, and this one flagged working code until it matched object keys too.

**THE WAVE PILL WAS LANDING BESIDE THE BATTLEFIELD, THE METRIC GUARDING IT
REWARDED THAT, AND A BUDGET HAD ALREADY BEEN TIGHTENED ON THE STRENGTH OF IT.**
The pill is scored in CANVAS coordinates and was POSITIONED by the stylesheet,
which anchors to its offsetParent — the canvas WRAP. Wherever the board is
HEIGHT-limited the canvas is narrower than that wrap, so the pill sat off the
field on the page background: measured **40px off at 320, 46 at 360, 100 at 768
and 79 at 834**, while 390 and 414 (canvas inset 6px and 4px) and both landscapes
looked perfect. The Y axis is clean — `cv.offsetTop` is 0 at all nine sizes —
so only one axis mixed.
**This is a half-fix of my own, from earlier the same day.** That commit moved
the SCORING into canvas coordinates and left the PLACEMENT to the CSS, and its
own comment congratulated the change for taking 320 from 7 covered maps to 3.
Measured now: the 3 was bought by letting the pill hang 40px off a 224px field.
**Off the field is further from every lane, so the dodge metric actively
rewarded leaving the battlefield** — the anchor was scoring a position it could
not legally take and calling it the best one. Constrained to the canvas it is 7
again, which is the honest number and still far better than the 16 a fixed centre
gives there. Every other budget is unchanged (390 → 1, narrow landscape → 1, both
tablets → 0), so only the one that the bug had flattered moves.
**And the tablet clause's comment had written the bug down as the feature**: it
credited "the whole margin beside a height-limited board to dodge into". Measured
on the canvas alone it is still 0 against a fixed centre's 9, so the margin was
never what earned it. A comment cannot go red, and this one was describing a
defect approvingly.
Three lessons. **A coordinate-space fix must move every consumer of the space,
not the one that motivated it** — this engine's `+0.5` trap has now appeared in
the LAYOUT layer twice, the second time inside the fix for the first. **Look at
the picture to find it, measure every size to size it**: the defect was found by
screenshotting tablet portrait (the size that once surfaced the toast overlap),
and measuring then showed the two NARROWEST PHONES were worse-hit than the tablet
I was looking at. And the design question was settled by the screenshot rather
than by argument — a pill sitting fully in the margin covers no lane, but at 320
it STRADDLES the field's edge, half on the board and half on the page, which
reads as a rendering error; covering a lane's first cells on 7 of 40 maps at the
narrowest size is the lesser cost.
**My own probes were wrong twice while measuring this, in the same way as the
last one.** The first scored every waypoint instead of the shipped test's first
six, and measured the WAVE-phase pill where the test measures the BUILD-phase
one — two different elements — and reported 1 covered map at 320 where the test
reported 7. When a probe disagrees with a green test, copy the test's measure
verbatim rather than writing a new one. Note also that the dodge budget CANNOT
catch a regression here (off-field scores under the ceiling), which is exactly
why the constraint gets its own clause, with a non-vacuity check that at least
one tested size genuinely insets the canvas — on a width-limited board every
anchor is on the field for free.

**A PAUSED BATTLE HELD ITS FRAME LOOP STILL AND ACCEPTED PLAY INPUT ANYWAY — the
scrim stops a finger, and that is ALL it stops.** Found by looking at the pause
menu and noticing the field dimmed while the top bar and power tiles did not.
Measured: with the menu open, `elementFromPoint` correctly returns the overlay at
the centre of every play control, so a real tap is blocked — and Tab reaches
**8 controls behind the dialog**, where a keyboard user can change the ⏩ speed,
arm a power, spend **450🪙** on ⚙️ energy (10894 → 10444) and **BUILD A TOWER**,
all while `cur.paused` faithfully freezes the simulation. `aria-hidden` was never
set on the play screen, so a screen reader or switch access reaches them the same
way. The engine has no notion of pause (it is a td-main session flag), so
`buyCharge` could not have refused on its own.
**The fix is on the ACTION, not on one input channel's reachability.** A focus
trap would have fixed keyboard and left the next channel open; gating the action
covers pointer, keyboard, AT and anything future in one place, and is testable by
a DOM `el.click()`, which ignores the scrim entirely — the same way this suite
already drives every tap.
**It is ONE capture-phase listener on the play screen, and the first cut was a
per-listener wrapper that was already a list somebody forgets to join** —
wrapping the seven named controls left the BUILD MENU's own buttons open, so a
menu left up behind the pause dialog still built towers. My own probe missed
that (it never had a bubble open) and the guardrail's own clause caught it,
which is the test doing its job. Capture on the screen covers every control on
it, bubbles and any control added later, with events inside `.td-overlay`
exempt because the dialog is appended to that very screen.
Three things are deliberate and each is mutation-proven. **`.td-bubble` is NOT a
modal** — the build menu and the tower panel are field dialogs, and building and
inspecting mid-wave is legal, which is the whole reason they are not overlays; a
mutation that gates them too turns four shipped tests red. **The dialog exemption
is load-bearing** — gating everything breaks the pause menu itself. And **the
CONTROL clause comes FIRST in the test**: with no modal open every one of these
controls must still act, or a guard that simply blocked everything would pass the
clause it exists for. **`fieldAimEnd` stays unguarded on purpose**, because it
only clears the aim ring and blocking it could strand a preview on screen —
that one is stated rather than proven, since no shipped path opens a modal
mid-drag.

**A DOWNED SOLDIER WAS INVISIBLE FOR SEVEN AND A HALF OF ITS EIGHT SECONDS — and
the same enumeration that found the two undrawn body states never ran on the
TOWER side.** The method is the recorded one (`<name>Until`/`<name>At` is this
engine's convention for a timed mark, so the population derives): eleven exist,
and the only one with ZERO references in `td-render.js` was `respawnAt`. A camp's
whole job is a wall, `respawn` is **8 seconds on every camp tier** (4 on RC
Racers), and the field gave it a 0.6s dust puff and then nothing at all — so a
hole in your wall was indistinguishable from a post you never manned, and
📣 Rally Horn, whose entire value is standing the squad straight back up, was an
80🪙 purchase you had to make blind. It is a dashed ring with a draining arc now:
the shape says *one of yours is missing here*, the arc says *and it is nearly
back*. Six things worth keeping. (1) **The engine had to grow an accessor,
because the obvious field LIES.** `rally()` deliberately updates only LIVING
soldiers' posts (a downed one is re-slotted when it stands up), so a marker drawn
at `sol.tx/ty` points at the wall you just moved away from. `soldierReturn` reads
the same `postOf` the respawn reads, so the marker cannot disagree with the
respawn it predicts — and that is the clause the whole test hangs on. (2) **The
first cut was the Sparkler defect again**: measured at the real 27px cell, one
pass gave **54 ink px at mean delta 54 against a living soldier's 136 at 181** —
the mark for a missing body was the faintest thing in its own neighbourhood.
Dark-under-bright takes it to 193/143, and the bar is a COMPARISON against a
living soldier on the same floor rather than a pixel constant, because ten worlds
run from a near-black attic to a bright party carpet (measured mark-vs-body
contrast 0.80 / 1.17 / 0.91 on bedroom / attic / party). (3) **The SCREENSHOT
found what every number missed.** At radius 0.30 a single downed post is perfect
and a WIPED squad — the case the marker exists for — drew one tangled chain,
because `rallySlots` spaces posts 0.52 cells apart with a ±0.1 stagger (0.557
centre to centre) and a 0.60 ring must merge. So the radius is DERIVED from the
squad's own spacing (`postOf` now reports `gap`; the marker takes 40% of it), and
a fixed constant cannot come back. (4) **A centre-line profile could not express
"separate"** — the drain arcs cross the axis, so it reported one continuous run
on markers that are plainly three; the falsifiable form is the geometric one,
read off a `postMarkInfo()` hook (the `leverInfo` precedent) rather than
re-derived in the test, where the expectation would move with the formula under
test. (5) **Two mutations fired the WRONG clause first**, the recurring
earlier-clause trap: freezing `left` to fake a stale post tripped the DRAIN
check, so the rally clause was still unproven, and making the engine answer for a
living soldier put a marker into the bare-floor CONTROL frame and tripped the ink
check. Isolating them meant a mutation that keeps the drain honest and moves only
the position, and reading the living-soldier answer FIRST, before any drawing can
confound it. (6) **One clause is an outcome TWO guards deliver, and the comment
says so**: `alive` and `respawnAt` both make the answer null, so dropping either
alone stays green (proven — M6 passes) and only dropping both turns it red;
alive-with-a-pending-respawn is not a state the engine can reach on its own.
One fixture note: a soldier SPAWNS at its camp and marches, so the living-body
control has to be walked to its post first — sampled before it arrives it reads
zero ink, which looks exactly like a working comparison and is not.

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
│   ├── td-logic.js             # 🏰 PURE deterministic engine (30Hz fixed-step, seeded RNG only, zero DOM; dual-export for node sims) — TD-7 lane-aware (paths[]/pathIdx, pullLever); TD-15 waveIdx=cleared vs sentIdx=sent, so waves can OVERLAP (callInfo/⏩ RUSH); guide truth DERIVED from data (enemyTraits/reachedBy/levelGimmicks) + pure floor-prop placement (propCells — a new enemy or gimmick documents itself or the coverage guardrail fails) + pure `laneCoverage` (what share of the lane a pad reaches, validated against real damage) behind the engine's `coverageOf(line, tier, cx, cy, branch)`, the ONE owner the build menu and tower panel read; P3 ⚙️ energy budget + 🧨's reveal rider through the ONE `isHidden` gate + ⚡'s crash (frozen across a build phase); P4 records the run's equipped loadout on `state.meta`; P6 records the run's equipped POWERS on `state.powers` (`abilityReady` refuses `not-equipped` first) and 📌's `markId`/`markUntil` override every mode through the ONE `pickByMode` + the dart's sticky-KEEP; TD-18 run CHIPS are pure input like meta/powers, refused in the FIRST clause of `place()`/`abilityReady()` (never in the UI), and `jamNearest` is the ONE owner the Loose Screw and the 🎇 Sparkler share; `rosterTricks`/`NOT_A_TRICK` are the ONE owner of "which trait keys are MECHANICS" (the fort home's blurb counts them, so it is a product decision — it used to be a literal in td-ui AND a copy in the test); `worldOrder`/`byWorldOrder` are the ONE owner of "what order do the worlds come in" (derived from the campaign — the endless picker sorts through it rather than rendering whatever order `ENDLESS.worlds` happens to be typed in)
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
**I DOCUMENTED A MECHANIC FROM ITS IDENTIFIER INSTEAD OF ITS IMPLEMENTATION,
AND SHIPPED THE LIE — caught by screenshotting the star tree an hour later.**
The engine's fifth aiming mode is `cheap`, so the guide entry I had just written
described it as *"the body worth the most gold. A 💰 Economy pick — it turns
your guns toward the payday rather than the threat."* The engine does nothing of
the kind: `else if (mode === "cheap" && e.hp < best.hp)` — it finishes the
almost-dead — which is exactly what the 🔻 Weak Spot node that unlocks it has
always promised ("Unlock **Weakest** aim"). The tree and my new guide
contradicted each other in the same app, and the tree was right. Four things
worth keeping. (1) **An id is a name somebody chose once; read the code.** This
repo already records the mirror of it twice — an enemy's id being load-bearing
on the tick stream, and *"a named mechanic must BE that mechanic"* (四宫数独 was
a Latin square) — and this is the third face: a mechanic whose OWN NAME
misdescribes it, where trusting the name produces false player copy. The other
four modes were checked against the implementation line by line and are
correct. (2) **A structural guardrail cannot catch a false description.** Mine
asserted every mode the engine offers HAS a description and that nothing is
described which the engine never offers — both green while the text was wrong.
Only driving the engine and reading which body it picks can pin the meaning, so
the test now sets two bodies to 900 and 120 hp and asserts `cheap` takes the
120 and `strong` the 900, then asserts the words match. (3) **The button was
printing the engine's id**, so the one mode you have to BUY read "cheap" while
the node granting it said "Weakest" — each mode carries a player-facing `name`
now, and the guardrail ties it to the node's own promise. (4) **The fixture
needed a BUILT path**: `posAt` takes `buildPath()` output (segs/total), and
handing it the level's raw `path` array throws "path.segs is not iterable" —
suspect the fixture, again.

**THE STICKY ✕ WAS EATING THE END OF LINES IN FIVE OF THE NINE FORT DIALOGS —
found by SCREENSHOTTING my own new guide section, not by any test.** It was
added so a long dialog could be closed from the top (the 30-node star tree
otherwise meant scrolling to the bottom just to shut it), and it shipped as a
bare `position: sticky` circle riding the box's right edge — so every line that
scrolled past lost its right end. Measured across all nine: ⭐ Star Tree covered
a node's **⭐ cost** (the number you decide with), 🏅 Badges an achievement's
description, ♾️ Endless its blurb, ⚙️ Reset its own title, and 📖 Guide 601px²
of prose. Four things worth keeping. (1) **A full-width opaque STRIP, not a
right gutter.** A gutter is the obvious fix and costs 52px of a 296px dialog
permanently, on every line, for a button that only occupies the top corner; the
strip costs zero width and turns "a circle eats the end of a line" into
ordinary scrolling under a header, which is what every app does. (2) **The
sticky offset is measured, not guessed** — at `top: 0` the strip parks 24px low
and strands a 16px band of text ABOVE it, which reads *worse* than the circle
(a line floating over an opaque header looks broken); `-22px` leaves 2px,
`-26px` overshoots, and `-24px` — the box's 22px padding plus its 2px border —
lands flush. (3) **The metric had to change with the fix, and the obvious one
lies.** Geometric overlap cannot tell "hidden behind an opaque full-width
header" (fine) from "clipped by a circle" (the defect), because a text rect
reports its box whether or not anything is painted over it — after the fix my
first probe still reported overlaps on all five. The honest property is
OCCLUSION: sample `elementFromPoint` along each line, and a line where some
points reach the text and others reach the close control is half-covered. (4)
**Two fixture traps on the way.** The first walker reported the ✕'s own glyph
overlapping itself, because the button's subtree was in the walk. And the
mutation that restores the bare circle fired the non-vacuity clause ("at least
a few dialogs must scroll") rather than the one written for it — the probe
returns early with no strip, so nothing counts as scrollable — and because I
grepped for only the expected message, I briefly read that red run as GREEN.
Assert the defect BEFORE the non-vacuity guard, and never grep for one message
when the test has several.

**THE MOST FREQUENT DECISION IN THE GAME SHOWED A PRICE AND NOTHING ELSE.**
The ⬆ button read `110🪙` while the tier-3 branch cards two lines below it have
always stated their move (`road 12%→28%`) — so the panel told you what a 300-gold
ultimate buys and not what a 110-gold upgrade buys, which is the same
information problem the `% road` figure fixed for placement, one decision over.
It now previews the next tier on a green `→` line. Four things worth keeping.
(1) **It is the SAME formatter, parameterised** — `towerStats(towerId, tierAt)`
rather than a second function, because this is the only place the star-tree mods
are applied to a printable stat block and two copies of that is exactly how the
panel came to print 110 while the engine charged 99. It uses the tower's own
`cx/cy/supRange`, so the preview keeps its ⚡ power pad and its 🧊 Tail Wind
support — an upgraded tower does not lose them. (2) **Measured against the fold,
because this panel is the one a third branch row was rejected for** (+111px, past
the fold at 320×480, 320×568 and landscape): the preview costs **+26px**
(183 → 209) and sits at 171..380 in a 480-tall viewport, ~100px clear. (3) **The
mutation that makes the panel too tall fired the WRONG clause** — a 9rem preview
disturbed the tier-3 flow, so the "a tier-3 panel offers branches" assertion
failed first and the fold clause never ran. Reordered so the fold check comes
first; the documented "a mutation that fires an EARLIER clause has not proven
the later one", now landing on layout rather than on text. (4) **And a mutation
that leaves the rest of a sentence intact does not shorten the string** — cutting
`close: "whatever is nearest…` to `close: "x` left 80 characters of tail and the
`length > 20` clause passed; the honest mutation deletes the whole entry.
**The same pass gave the 🎯 button its words.** It cycles *first / last / strong
/ close / cheap* and nothing in the app said what any of them meant — while
`AUDIT targeting is a LIVE lever` measures the best mode as worth **4-9 lives**
on a boss finale, with a different winner per level. "First" (furthest along the
lane) versus "close" (nearest the gun) is genuinely ambiguous, so a lever that
decides levels was unreadable. `DATA.TARGETING` owns the words, the ENGINE still
owns the list, and a derived guardrail asserts every mode `targetingModes()`
offers has a description AND that nothing is described which the engine never
offers — so a sixth mode cannot ship undocumented and a removed one cannot leave
a paragraph behind. Paired, per the standing rule, with a browser test that
opens the real 📖 Guide and reads the modes off the rendered page: a structural
scan proves the table exists, only opening the guide proves the render loop puts
it there. The guide also now mentions the ⬆ preview, because a feature shipped
without its description is the side-door staleness class, and that was fixed an
hour earlier in the same file.
**And the Powers rows stated cost, ⚙️, cooldown and where to tap — but not how
BIG.** 🧨 is 130🪙 and 2.4 cells wide, and the one number that decides WHERE you
tap was the one missing, so an aimed power was aimed by eye. It is a data field
already (`ABILITIES[].radius`), shown only when present so an instant power does
not grow a meaningless "0 cells", and guardrailed by derivation. Its first
clause matched `radius + " cells"`, which **passed for 🍯 Sticky because "2
cells" appears elsewhere in the guide** — the mutation named only two of three
powers, which is the tell. Matching the exact rendered phrase names all three.
A substring assertion over a page's whole text can be satisfied by a
coincidence; make the needle specific enough that only the thing under test can
produce it.

**A RESTORED CHECKPOINT COERCED ITS ARRAY AND TRUSTED ITS NUMBERS — the same
function disagreeing with itself, which is the third time that smell has found
a real defect.** `resumeMidRun` reads `Array.isArray(mr.towers) ? mr.towers :
[]` because a malformed backup once threw "mr.towers is not iterable"; the
scalars on the next line — `waveIdx`, `gold`, `lives` — were never given the
same treatment. A 💾 Backup restore is a PASTE, validated only as "parses, is
an object, `v === 1`, `stars` is an object", so a truncated or hand-edited one
arrives here intact. **And a junk `waveIdx` does not fail politely**: verified
against the engine, the board comes back looking perfectly correct and the
FIRST ▶ CALL throws `Cannot read properties of null (reading 'groups')` inside
the click handler, so the run freezes in build with nothing said — a silent
death one tap after a successful-looking restore. Four things worth keeping.
(1) **The line is COERCE what has a sane default, DISCARD what does not.**
`towers → []` is sane: you lost your board and the run plays. `waveIdx` has no
sane default — resuming at wave 0 with wave-12 gold is a different, wrong run —
so it is refused and the checkpoint cleared, matching the `!levelDef` branch one
line up. Both behaviours now sit in the same test so the next reader sees the
distinction rather than picking one. (2) **The obvious bound throws away every
ENDLESS resume**, because endless has no wave TABLE — its waves are generated —
so `(levelDef.waves || []).length` is 0 for them and every checkpoint would be
refused. Mutation-proven; that clause exists because the natural implementation
is wrong. (3) **`Number(null)` is 0, so a coercing check "validates" nothing** —
it waved a null `lives` straight through while looking rigorous. The predicate
is `typeof v === "number" && Number.isFinite(v)`, plus an INTEGER test for the
wave, since `waves[1.5]` is undefined and throws exactly like `waves[999]`.
(4) **The test seeded localStorage without a RELOAD and so passed against a
working guard** — the module keeps its in-memory copy, the seed is invisible,
and the resume succeeds against the old checkpoint. The clause directly above it
reloads for exactly that reason; this is the documented same-document
footgun landing one more time. And from the same batch: **a whole-object
`deepEqual` on a settings blob fails the moment ANY new setting is added**, even
though nothing about the behaviour changed — the ⏩ speed preference turned the
reset guardrail red naming a field it had never heard of. The claim is "the
reset loses no preference", so it is asserted per seeded key now; a reset that
adds a defaulted key is not a preference-loss bug, and the weakened form still
goes red when preference-keeping is removed.

**THE BOSS DRONE — the one voice whose whole job is to say "this is serious" —
WAS INAUDIBLE IN ALL TEN WORLDS, and the reason nothing caught it is that its
frequency is COMPUTED.** Every tone literal in the app is eyeballable and sane
(the lowest anywhere is the mortar splash at 110Hz); the music is the one place
a frequency is derived, `root × 2^(semi + 12·oct)/12`, and the drone at
`hz(0, -3)` is root/8 — **18.4Hz in the garage and 19.4 on the sort line, BELOW
the ~20Hz threshold of human hearing**, and 24-37Hz in the other eight, which
no phone speaker reproduces. So a voice slot (of JoshAudio's 12) and an
oscillator were spent on silence, on the cue that matters most. Found by
exhaustively evaluating every voice the pure `musicStep` can emit — 212,500 of
them across every world × phase × boss × danger — which is cheap precisely
because the score is DATA and the arrangement is PURE. Fixed with an
octave-FOLD to `DATA.MUSIC.floorHz` at the ONE site every voice goes through,
so a future low voice inherits it. Five things worth keeping. (1) **Fold, never
clamp** — a clamp satisfies "nothing below the floor" while changing the NOTE,
so the test needs a second clause that folded/unfolded is a power of two; the
clamp mutation reports `ratio 2.2449`. (2) **An unbounded `while (f < floor) f
*= 2` inside the tick cannot FAIL, it HANGS** — and verified, it hangs
`node --test` rather than failing it, which is a step worse than a green test
because it reads as broken infrastructure. Bounded now, and the comment says
plainly that the bound is defence-in-depth which cannot fail while the `f > 0`
guard stands — its whole job is that removing that guard yields a wrong NUMBER
a test can report. (3) **`root: 0` does not separate the two protections and a
NEGATIVE root does**: with the loop bounded, 0 folds to 0 and the existing
`if (f)` truthiness check drops the voice, so the guard looks redundant; -220
doubles to a LARGER negative, stays truthy, and reaches the oscillator — the
probe reports `hz=-1350154`. When a mutation passes, find the input that
separates the claims. (4) **A test-name pattern that matches NOTHING reports
`# pass 1` and green mutations.** Three mutations "passed" against
`--test-name-pattern="music"` because the test is called "🎵 the score is
per-world…" — no match, so node ran the FILE with zero subtests and my new
assertions never executed. `# pass 1` on a 196-test file was the tell. (5) The
same pass shipped two smaller things: **⏩ fast-forward is now remembered
between levels** (it was hard-reset to 1× at every start, so a 2× player
retapped on all 40 levels and every restart) — CLAMPED, because it is a NUMBER
the frame loop multiplies by, and note the `|| 1` fallback masks a saved 0 but
NOT a saved 99, so the clamp is load-bearing only at the top end and the test
must probe there; and **the Toybox Guide's side-door entry still described the
version that was broken**, saying the door "is marked on the field" without
mentioning that it now pings a whole wave BEFORE it opens — which is the entire
fix, and the thing the original complaint was about. Player copy cannot go red
on its own, so a feature can be improved and its description left behind; that
sentence is now tied by a guardrail to the renderer that implements it.

**AND THEN IT WORKED, ON ATTEMPT 3 — verified from the log, which corrected my
own reading of the clock.** Run #325's install ran 51m45s and came back GREEN
with `##[notice]Playwright browsers installed on attempt 3`. From the
timestamps: attempt 1 timed out at the 25-minute bound, attempt 2 timed out too,
and attempt 3 then succeeded in about **39 seconds** — the locks cleared and the
browser cache serving. I had reported "attempt 2 completing" from the duration
alone before reading the notice; the elapsed time was consistent with either,
and only the log says which. Three facts worth keeping: the retry is now
genuinely able to recover a stalled install (it never had been), a post-cleanup
attempt costs seconds rather than minutes because the cache removes the
download, and the same run's verify-live install took **44 seconds** on a warm
cache. Both CI fixes were needed and in this order — without errexit cleared
there was no attempt 2 to observe, and without the lock cleanup attempts 2 and 3
died in 20 seconds each.

**AND WHEN THE RETRY FINALLY RAN, IT COULD NOT WIN — a killed attempt leaves
apt ALIVE, holding the lock its own retries need.** Run #324 is the first run
where all three attempts happened (the errexit fix working), and it still went
red: attempt 1 timed out at 25 min, then attempts 2 AND 3 each died in about 20
seconds on `E: Could not get lock /var/lib/dpkg/lock-frontend. It is held by
process 2640 (apt-get)` — **the same pid both times**, with apt still printing
`Get:` lines after the script had given up. The mechanism is that
`--with-deps` runs apt under **sudo**, which puts it in a different session, so
`timeout`'s process-group kill never reaches it. So the retry was structurally
correct and practically useless against the one failure mode it exists for, and
the two fixes had to be made in this order to be visible at all: without the
errexit fix there was no attempt 2 to observe failing. Three things worth
keeping. (1) **A retry that cannot succeed is not a retry** — clear the state
the killed attempt left before trying again, or you have bought three fast
failures instead of one slow one. The cleanup kills leftover apt/dpkg, removes
the stale lock files and runs `dpkg --configure -a` to repair a half-configured
DB, between attempts only. (2) **`pkill -x`, never `pkill -f`**: matching the
full command line with a pattern like `dpkg` matches the cleanup line *itself*
— and that is not hypothetical, a `pkill -f` killed the shell it was typed in
earlier the same day (exit 144, twice). The guardrail bans `-f` here for that
reason. (3) **The bound is still not the problem, and now there is a run that
proves it.** The note beside `PER_ATTEMPT` said not to raise it again without a
run that actually made all three attempts; #324 is that run, and it says
attempts 2 and 3 failed on a LOCK in 20 seconds, not on time. Raising the
timeout would have changed nothing.

**THE RETRY DID NOT RETRY, TWICE — and the cause was `errexit`, one character,
after I had already shipped a fix for a mechanism that was not happening.**
Runs #320 and #321 both ended with ZERO `::warning::` lines: the first failing
attempt ended the script, so attempts 2 and 3 never ran and two deploys were
lost to exactly the stall this action exists to survive. **GitHub Actions runs
`shell: bash` as `bash --noprofile --norc -eo pipefail {0}` — errexit is ON —
and `set -uo pipefail` does not clear it.** So `code=$?` was never reached and
the step exited with the command's own status. `set +e` is the fix.
Four things worth keeping, and the first two are about how I got it wrong.
(1) **The behavioural guardrail drove the shipped script TEXT and still could
not see it, because it spawned a plain `bash script.sh`.** A harness is only as
faithful as its INVOCATION, not just its input — plain bash gives 3 attempts and
exit 1, `bash -e` on the same text gives 0 attempts and the command's own exit
code, which is the CI signature byte-for-byte. It spawns `bash -e` now.
(2) **I diagnosed it as a process-group kill first, shipped `setsid --wait` for
that, and the theory was REFUTED by the next run** — which failed identically
but reported 124 instead of 137, i.e. my TERM change had worked at the signal
level and changed nothing about the retry. The tell was there and I read past
it: the step duration was 1505s BOTH times, exactly one attempt, which no
process-group story explains. The `setsid` wrapper is gone rather than kept as
a fix whose stated reason is false — the same call this repo already made for
the redundant price-flash paint and the dead `noInk` wrap. What survives from
that pass is measured and independent: `--signal=TERM --kill-after` shuts down
cleanly and reports 124 ("it stalled") rather than a bare 137 ("something
killed it"), and `--foreground` is banned because it genuinely does leave the
command in the shell's own process group, where a command that signals its
group takes the loop with it. (3) **I also claimed mid-investigation that the
fix was working, from arithmetic on a jobs response I had not re-queried** —
the step had already ended; "still running past the bound" was a stale reading.
Re-fetch before believing an elapsed-time argument. (4) **Run #320 is still not
evidence the 25-minute bound is small.** Both stalls were apt going silent
inside `--with-deps` — the case the retry is for — and the retry is what was
broken. That note sits beside the constant, because the tempting reading of a
killed attempt is always "raise it", and this repo has already raised it three
times.

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
`td-logic` ~14 min CPU (the 32-level sims — inherent; the campaign is 40 levels now, so that figure understates it by ~25% and a local run measured 23 min — a justification refuted by later data, which a comment cannot report), `e2e` 593s, `td` **69s**,
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
