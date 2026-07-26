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
│   ├── td-data.js              # 🏰 Fort Josh (Jon's TD): ALL balance/content truth (dual-export) — towers/16-enemy roster/3 bosses/16 levels (4 worlds; L3/L7/L10 = TD-7/TD-11 fork+lever)/gimmicks + meta (TD-8 deep star tree: 3 branches × 23 nodes/77⭐, 12 achievements, one endless arena PER WORLD — the attic's was missing)
│   ├── td-logic.js             # 🏰 PURE deterministic engine (30Hz fixed-step, seeded RNG only, zero DOM; dual-export for node sims) — TD-7 lane-aware (paths[]/pathIdx, pullLever); TD-15 waveIdx=cleared vs sentIdx=sent, so waves can OVERLAP (callInfo/⏩ RUSH)
│   ├── td-render.js            # 🏰 canvas renderer (reads state, never mutates; lerps between ticks) + TD-6 screen-shake (reduced-motion-gated) + opt-in damage numbers + TD-7 multi-lane ribbons + lever button + PER-TIER tower art (T1/T2/T3 + all 6 tier-4 branch silhouettes) and one draw branch per enemy (both pixel-hash guardrailed)
│   ├── td-ui.js                # 🏰 screens/HUD/overlays (opens directly from the front door's 🏰 tile — no gate; controls stay data-adult) + TD-5 star-tree/badges/endless overlays, resume banner, achievement toast; the level grid + the power strip both DERIVE from data (grid = every shipped level; strip lives OFF the field)
│   ├── td-main.js              # 🏰 glue: JonTD routing + jon-td-* save (meta/ach/endlessBest/midRun) + rAF loop + input + sfx + achievement tracking + endless/resume + window.__TD test hooks
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
deterministic engine + **all 16 Levels across 4 worlds** (Bedroom L1-4, Backyard
L5-8, Toy Store L9-12, Attic L13-16; distinct path/pad layouts, each
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
levels stay byte-identical: `paths=[path]`, every `pathIdx` 0). **L10 "The Train
Set"** is now a real fork+lever: two lanes share a prefix then split at the fork
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
future tower line inherits it free) and 📣 **Rally Horn** (every downed soldier
straight back up). Two deliberate design laws: each costs **gold** as well as a
cooldown, so an ability is a real trade against a tower rather than free power
(it can't silently inflate the curve — the auto-solver never uses them, so every
winnability sim stays conservative and needed no re-tune); and all four are
**pure deterministic** (tick-stamped cooldowns, zero rng), so a headless sim
drives each one and an ability-using run still replays byte-identically.
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
> - **Forks/levers exist on only 3 of 16 fort maps** (L3, L7, L10). The World-4
>   maps were authored after TD-11's fork search ran, so the attic was never
>   swept — re-run the generator (it keeps only detours that preserve the shared
>   prefix, stay in bounds, gain ≥20% length and leave every pad ≥0.99 cells
>   clear of BOTH lanes) to see whether any admit one without moving pads.
> - **Level gimmicks are thin**: `night` on L6 and `conveyor` on L7, and that is
>   all across 16 levels. The engine supports both anywhere, and the mole tunnel
>   is a third.
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
