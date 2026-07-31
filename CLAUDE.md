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

---

## Repository Structure

A plain static site — no framework, no build step. Tests and CI are the only
tooling.

```
.
├── index.html                  # The whole site: front door (#screen-start, 3 world tiles) + Josh's launcher shell; all other screens injected
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
│   ├── art.js                  # window.JoshArt — original homage SVG (hero/pup/numberFriend/friend/truck/rocket/fixable-scenes/…)
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
│   ├── td-data.js              # 🏰 Fort Josh (Jon's TD): ALL balance/content truth (dual-export) — towers/47-enemy roster (32 + 15 per-world backbone SKINS) + 8 bosses/32 levels (8 worlds; one fork+lever per world: L3/L7/L10/L15/L19/L23/L27/L31)/gimmicks + WORLDS presentation map (label/spawnGlyph/`backbone` — the ONE declaration `BACKBONE_TYPES`, the generator and the composition audit all derive from) + meta (TD-8 deep star tree: 3 branches × 30 nodes/105⭐ (vs a 96⭐ ceiling) against a 6-slot per-run `metaSlots` loadout, 17 achievements, one endless arena PER WORLD) + a per-world `floor` (pattern/palette/road tint/props triple) + P3 `chargePerWave`/`chargeMax` (⚙️ Toy Energy) + P6 `abilitySlots` (the 5-power pool the strip picks 4 of)
│   ├── td-logic.js             # 🏰 PURE deterministic engine (30Hz fixed-step, seeded RNG only, zero DOM; dual-export for node sims) — TD-7 lane-aware (paths[]/pathIdx, pullLever); TD-15 waveIdx=cleared vs sentIdx=sent, so waves can OVERLAP (callInfo/⏩ RUSH); guide truth DERIVED from data (enemyTraits/reachedBy/levelGimmicks) + pure floor-prop placement (propCells — a new enemy or gimmick documents itself or the coverage guardrail fails); P3 ⚙️ energy budget + 🧨's reveal rider through the ONE `isHidden` gate + ⚡'s crash (frozen across a build phase); P4 records the run's equipped loadout on `state.meta`; P6 records the run's equipped POWERS on `state.powers` (`abilityReady` refuses `not-equipped` first) and 📌's `markId`/`markUntil` override every mode through the ONE `pickByMode` + the dart's sticky-KEEP
│   ├── td-render.js            # 🏰 canvas renderer (reads state, never mutates; lerps between ticks) + TD-6 screen-shake (reduced-motion-gated) + opt-in damage numbers + TD-7 multi-lane ribbons + lever button + PER-TIER tower art (T1/T2/T3 + all 6 tier-4 branch silhouettes) and one draw branch per enemy (both pixel-hash guardrailed)
│   ├── td-ui.js                # 🏰 screens/HUD/overlays (opens directly from the front door's 🏰 tile — no gate; controls stay data-adult) + TD-5 star-tree/badges/endless overlays, P6's 🎒 Powers picker, resume banner, achievement toast; the level grid + the power strip both DERIVE from data (grid = every shipped level; strip lives OFF the field)
│   ├── td-main.js              # 🏰 glue: JonTD routing + jon-td-* save (meta/loadout/powers/ach/endlessBest/bests/midRun) + rAF loop + input + sfx + achievement tracking + endless/resume + window.__TD test hooks
│   └── main.js                 # Front door (#screen-start: 3 world tiles) + launcher (category menu + Surprise tile + 📖 Sticker Book + ⭐ badges) + hash router ('' = start, #home = Josh) + sound + SW; routes td-* through JonTD (try/catch-isolated)
├── tests/
│   ├── site.test.js            # node:test structure/wiring/content/guardrail checks (no browser)
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
│   ├── td-sim.js               # 🏰 measure any level with the SHIPPED oracle (normal/heroic/casual × seeds, + losable-by-neglect incl. the full star tree). `node tools/td-sim.js 13,17`. NEVER tune against a stronger solver — that is what got World 4 reverted. `--lever` measures what a fork's lever is WORTH (a thin build that LOSES on the short route and WINS with it thrown) — the right way to choose between fork candidates, since longest != best.
│   ├── td-wave-gen.js          # 🏰 emit + validate wave tables against BOTH contracts (±25% budget curve; ≥70% backbone / ≤1 special ≤25% / valve ≤12% / plain openers). `--check` audits every shipped level against the contracts it was AUTHORED under. The data file is written LAST.
│   ├── td-map-search.js        # 🏰 search lanes + pads against every geometry law (≥0.99 from EVERY lane, ≥1.4 pairwise, ≥1.9 from a lever, ≤BAND from the lane it must COVER), all in cell-index space. Edit the literals, run, paste into td-data.js.
│   └── td-fork-search.js       # 🏰 which shipped maps admit a SECOND lane with no pad moved? Enumerates axis-aligned detours and keeps only those passing every shipped fork law (shared prefix, real divergence, ≥1.15× longer, every pad ≥0.99 from BOTH lanes, ≥1.9 from the lever). `node tools/td-fork-search.js 15,23`.
├── package.json                # `npm test` → `node --test` (runs unit + e2e + mobile + offline)
├── package-lock.json           # committed for reproducible `npm ci` in CI
├── .gitignore                  # ignores node_modules etc.
├── .github/workflows/
│   └── deploy.yml              # CI: test (unit+e2e+WebKit) → deploy (cache-busts assets) → verify-live
├── JOSH_PROFILE.md             # WHO JOSH IS: skill levels, non-reader law, friends, interests, game-mechanic menu — READ before building
├── josh-profile.json           # ^ same profile, machine-readable (for programmatic game generation)
├── PLAN_ROAD_TO_140.md         # Set 1 build plan (40 games, waves W1-W4) — ✅ BUILT (Josh at 140)
├── PLAN_ROAD_TO_180.md         # Set 2 build plan (40 MORE: pick-place, toggle-match, reveal, co-op echo, waves W5-W8) — ✅ BUILT (Josh at 180)
├── PLAN_ROAD_TO_200.md         # Set 3 build plan (20 MORE gap-fillers: numeral trace, syllables, blending, compounds, analogies, measurement, life cycles, scene-zone, dump truck, waves W9-W10 + audit) — ✅ BUILT (Josh at 200)
├── PLAN_TOWER_DEFENSE.md       # 🏰 "Fort Josh: Toybox Defense" — Jon's adult TD world: full design (engine/towers/enemies/12 levels/bosses/meta/tests). Historical note: the plan's "Jon" name gate shipped, then was removed by request 2026-07 (front-door tile instead)
├── PLAN_WORLD_6.md             # 📦 ✅ BUILT: World 6 "Moving Day" — L21-L24, 🧻 Bubble Wrap (bonkResist — the Couch Cushion's mirror, and the first hard counter to the Dart), 📻 Boom Box (a hurry aura), The Moving Van boss, a 6th endless arena. §9 records the step function reproduced a THIRD time, and warns that a 7th world breaks the star-tree guardrail.
├── PLAN_GIMMICKS.md            # 🎛️ ✅ BUILT: TD-16 level gimmicks — 🕳️ mud patch (the conveyor's data field mirrored), ⚡ power pad (a socket that buffs whatever is built on it), 🚪 side door (a wave group that enters partway down the lane). §6 records what each is WORTH in lives, the zone-overlap bug, and why a mud patch had to come back off L5.
├── PLAN_EXPANSION.md           # 📈 PARTLY BUILT: phases 1-5 shipped (guardrails that can fail · per-world backbone SKINS + level distinctness · ⚙️ Toy Energy / 🧨 reveal / ⚡ crash · per-run loadout slots · **Worlds 7-8, L25-L32**, with the star tree grown to 105⭐/30 nodes so the ceiling guardrail still holds). Phase 6 (new content) PART-BUILT: **P6a** shipped the ability LOADOUT (`RULES.abilitySlots`, `save.powers`, the 🎒 Powers picker) + 📌 **Call the Shot**, with the critique's corrections applied; **P6b** shipped 🦆 `zapResist`, **P6c** shipped ⛱️ `zones[].dmg`, and **P6d closes the I5 new-enemy item**: of its three bodies, 🪂 Parachute Trooper was cut by the critique (the Tin Plane renamed), 🥫 Pantry Can was cut by MEASUREMENT (a shield is anti-Fan only — see the learnings block), and 🛢️ **Oil Drum shipped** on a positional axis instead of a resist. The spec was found NEEDS_CHANGES on 16 counts (`scratchpad/specs/10-crit-content.md`); note that its critique was itself wrong about the shield arithmetic, so treat both as claims to measure. §0 is the star-ceiling finding — read it before adding a NINTH world (36 levels = a 108⭐ ceiling and the guardrail goes red); several of its own premises were refuted by measurement, and the corrections are in this file's learnings block.
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
deterministic engine + **all 32 Levels across 8 worlds** (Bedroom L1-4, Backyard
L5-8, Toy Store L9-12, Attic L13-16, Garage L17-20, Moving Day L21-24, **🏠 The New
House L25-28** (the reprise world — 🪑 Flat-Pack Chair and 🔑 Spare Key skins on a
pale drop-cloth floor, The Housedog boss) and **♻️ The Sort Line L29-32** (the step
AFTER being kept — 🧃 Juice Carton, 📎 Runaway Clip and the campaign's first
EXCLUSIVE flier 📄 Loose Leaf, on steel grating with a dark rubber-belt lane; The
Big Magnet closes the campaign); distinct path/pad layouts, each
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
budget `300·1.16^n`, a mini-boss every 5th wave — unlocked once a world's 4
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
ships on **exactly one level in each of the 8 worlds** (L3, L7, L10, L15, L19,
L23, L27, L31 — guardrail-locked, so a 9th world cannot ship without one). **L10 "The Train
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
buttons are a 172×180 block that would eat a third of Josh's field, so it keeps
floating — safe only because the `kid` difficulty is `noLose`. The audit is now
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
read. **Recorded, not forced:** `defaultRally()` measures a path point (cell
index) against the pad's WORLD centre, disagreeing with `rally()`'s own range
check — removing the bias is cosmetically correct and moves 237 of 247 pads'
rally points by up to 6 cells, re-posturing every camp on tuned levels and taking
soldier posts >0.5 cells off a lane from 1 to 4. Not worth the trade; fix it
alongside a camp re-tune. Finally, **the live-verify guard had the same
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
> **What IS open (opportunities, not obligations), measured 2026-07:**
> - **Forks/levers**: CLOSED — **every one of the 8 worlds now has exactly one**
>   (L3, L7, L10, L15, L19, L23, L27, L31), and `tools/td-fork-search.js` is in the
>   repo (with a `RESEARCH=1` flag) so the sweep is repeatable instead of a scratch
>   script that gets thrown away. Each one's VALUE is measured, not assumed.
> - **Level gimmicks**: CLOSED — 26 of 32 levels carry one (`night`, conveyor,
>   🕳️ mud, ⛱️ blanket cover, ⚡ power pad, 🚪 side door, fork+lever), all six worlds represented,
>   and every one now DOCUMENTS itself in the Toybox Guide via
>   `TDLogic.levelGimmicks` (guardrailed, so a new mechanic cannot ship
>   invisible). The FOURTH mechanic shipped (⛱️ Blanket Cover — `zones[].dmg`, damage-in-range beside the conveyor's time-in-range); what is still open is a FIFTH:
>   the shipped shapes cover slow / speed / buff / flank / reroute, and a
>   destructible obstacle or timed gate would each need a second engine read
>   site (see PLAN_GIMMICKS §6.4).
> - **Level DISTINCTNESS**: CLOSED for the 24 shipped levels. Every world has its
>   own backbone crowd (worst pairwise body-count similarity 0.691, was 0.997),
>   no two levels run the same special SCHEDULE (worst 60%, was five pairs at
>   100%), each finale's escort asks a different question, and every level has a
>   hook or a boss. All four are guardrail-locked, so a new level inherits them.
> - **The meta economy**: PARTLY closed. A run equips ≤ `RULES.metaSlots` (6) of
>   what it owns, so allocation is a per-run decision — but the measured NEGATIVE
>   result stands: L8 and L16 are boss-quantized, and three individual Firepower
>   nodes each erase L16 on their own, which no slot cap can fix. De-quantizing
>   those two finales (a leak-toll re-tune) is the open item, and it is a
>   deliberate balance pass to be commissioned, not a defect to fix on sight.
> - **The star ceiling** is the hard blocker on an 8-world campaign: it derives
>   as `LEVELS.length * 3`. Worlds 7-8 shipped and the tree grew with them: the
>   ceiling is **96** against a **105⭐ / 30-node** tree, margin 9. **A NINTH world
>   breaks it** — 36 levels is a 108⭐ ceiling and the "the tree must cost more
>   than you can earn" guardrail goes red. Grow the tree by BREADTH (new kinds
>   with real read sites) BEFORE adding one — never by adding ranks, which are
>   raw power. The seven nodes added for Worlds 7-8 were all breadth.

> - **华丽's world has had one adversarial pass** (the app-wide audit, which
>   found the 七夕节/汤圆 bin clash, 花's 把, and a 1.09:1 contrast failure) but
>   nothing like the fort's repeated ones. The iOS-14.2 and emoji classes are now
>   guardrailed app-wide, so a pass there would be about BEHAVIOUR: drive each
>   game, listen to the spoken sentence, prove no distractor is also correct.

## Development Workflow

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
