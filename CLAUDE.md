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
Safari** and be forgiving of little hands on every change:
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

---

## Repository Structure

A plain static site — no framework, no build step. Tests and CI are the only
tooling.

```
.
├── index.html                  # The whole site: one screen, giant friendly toy(s)
├── manifest.webmanifest        # PWA manifest (installable, standalone, icons)
├── sw.js                       # Service worker (network-first; offline; precaches core)
├── assets/                     # PWA icons (192 / 512 / maskable-512 / apple-touch)
├── styles/
│   └── main.css                # All styling (safe-area, static bg, ≥75px tap targets)
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
│   ├── hl-main.js              # 华丽's shell: 👵🏻 top-bar door + Chinese name gate (只有「华丽」能进) + red-gold launcher + 🏮 sticker book
│   ├── td-data.js              # 🏰 Fort Josh (Jon's TD): ALL balance/content truth (dual-export) — towers/16-enemy roster/3 bosses/12 levels (3 worlds)/gimmicks
│   ├── td-logic.js             # 🏰 PURE deterministic engine (30Hz fixed-step, seeded RNG only, zero DOM; dual-export for node sims)
│   ├── td-render.js            # 🏰 canvas renderer (reads state, never mutates; lerps between ticks)
│   ├── td-ui.js                # 🏰 door/gate/screens/HUD/overlays (gate = data-adult; ONLY the exact name "Jon" unlocks)
│   ├── td-main.js              # 🏰 glue: JonTD routing + jon-td-* save + rAF loop + input + sfx + window.__TD test hooks
│   └── main.js                 # Launcher (category menu + Surprise tile + 📖 Sticker Book + ⭐ badges) + hash router + sound + SW; routes td-* through guarded JonTD
├── tests/
│   ├── site.test.js            # node:test structure/wiring/content/guardrail checks (no browser)
│   ├── content.test.js         # CORRECTNESS: ground-truth restatement — answers can't silently go wrong
│   ├── hl-content.test.js      # 华丽 CORRECTNESS: poems/idioms/zodiac/量词/festivals/dishes/seasons truth tables + gate + FU_PATH tap geometry
│   ├── logic.test.js           # deep unit tests of scripts/logic.js (seeded RNG, exhaustive)
│   ├── e2e.test.js             # Playwright (Chromium) — GENERIC harness plays EVERY game + toddler-chaos double-tap guardrail
│   ├── mobile.test.js          # Playwright iPhone (real WebKit in CI) — overflow + ≥75px audit on home AND every game
│   ├── offline.test.js         # Playwright — drops the network and proves the PWA fully boots from the SW cache (no dead shell)
│   ├── td-logic.test.js        # 🏰 headless engine sims: determinism, combat math, wave-budget audit, L1 winnable-by-script AND losable-by-neglect
│   ├── td.test.js              # 🏰 Playwright: Jon gate, route guards, real build taps, scripted victory via __TD, defeat, pause/speed, kid-isolation, no-overflow
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
├── PLAN_TOWER_DEFENSE.md       # 🏰 "Fort Josh: Toybox Defense" — JON's hidden adult world (exact-name gate "Jon"): full TD design (engine/towers/enemies/12 levels/bosses/meta/tests) — TD-1 ✅ BUILT (shell+engine+L1), TD-2..TD-6 pending
└── CLAUDE.md                   # This file
```

> **To change any wording, animals, or colors:** edit `scripts/content.js` only.
> `content.js` works both in the browser (sets `window.JoshContent`) and in Node
> (`module.exports`), so the tests assert the real content.

Update this tree whenever files are added or moved.

## Current Site Behavior

A **launcher home screen** (`#screen-home`) on a **static** sky→meadow→sun
gradient: a big grid of friendly game **tiles** (icon carries the meaning; a
short label is for the grown-up). Tapping a tile opens that game via the URL
hash (`#game-id`) so the phone Back button works; a big **🏠 Home** button
returns. A giant **sound toggle** 🔇/🔊 lives in the top bar — **sound is OFF by
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
  things among Josh's toys — a warm bridge to the hidden 华丽 world, closing on a
  spoken 谢谢). *(The tap-to-fill co-ops now each carry a real skill — skip-count,
  countdown, counting — not just turn-taking.)* *Set 2:* **Month Train** (the
  months in order), **Set the Table** (pick-and-place practical life), **What
  Goes First?** (getting-dressed order), **Team Puzzle** (2-player pick-and-place
  jigsaw), **Team Song** (2 players play Twinkle's notes in order), **Team
  Balance** (2 players level a scale — equality), **Copy Me!** (2-player
  leader/follower echo), **The Worry Box** (SEL — tuck each worry away), **Thank-You
  Hearts** (gratitude — every choice is right). *Set 3:* **Tidy Up Time** (put
  each toy in its home bin — practical life, pick-and-place).

### 👵🏻 华丽的世界 — the hidden world for Josh's Chinese grandma

A **second, hidden mini-site for Grandma Huali (华丽)**, entered through the 👵🏻
button beside the sound toggle: it pops a Chinese name gate (「你叫什么名字？」)
and **only the exact answer 「华丽」** (trimmed + NFC-normalized, session-scoped
in `sessionStorage["hl-ok"]`) opens `#hl-home` — every other input is gently
rejected. Inside, the page turns **red-and-gold** (`body.hl-mode`) and ALL text
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
- Nav screens bounce to Josh's home without the session flag; game screens stay
  deep-linkable (the harness needs them, and a non-reader can't type a hash).
  Her name gate is `data-adult` (adult-sized controls, exempt from the kid audit).

### 🏰 Fort Josh: Toybox Defense — the hidden world for JON (dad)

A **third, gated world**: a real tower-defense game behind the 🏰 top-bar door.
The name gate accepts **only the exact input `Jon`** (trim+NFC, case-sensitive;
`sessionStorage["td-ok"]`, session-scoped). This is an **adult space**: real
difficulty, real defeat screens, real timers — RULE 5's kid laws deliberately do
not apply inside (the gate is what keeps it from Josh; precedent: 华丽's
`data-adult`). Status: **TD-1 + TD-2 + TD-3 + TD-4 shipped** — shell +
deterministic engine + **all 12 Levels across 3 worlds** (Bedroom L1-4, Backyard
L5-8, Toy Store L9-12; distinct path/pad layouts, a rising difficulty curve, each
proven winnable by a headless best-of-two auto-solver + losable by neglect, and
L12 winnable on Heroic; beat level N to unlock N+1, ▶ Next-level on the victory
screen; the fort home shows world tints, difficulty pips, and a 👑 on each boss
finale), the FULL enemy roster — World-1 (Sock/Marble/Balloon + Mud Blob
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
drawing/taps/dialogs). **Deferred to a later pass:** true multi-path (dual/merge/
fork) layouts + the L10 lever (single rich paths ship now instead); the meta tree
+ achievements + endless (TD-5) and the audio/polish pass (TD-6) are specified in
`PLAN_TOWER_DEFENSE.md`.

Invariants (guardrail-locked in `site.test.js` + `tests/td.test.js`):
- **Never registers in `JoshFramework`/`JoshGames`** — no tile, no sticker slot,
  invisible to the every-game harness and the kid mobile audit. Josh's book
  stays exactly 200, 华丽's 40.
- **Storage is `jon-td-*` only** (`jon-td-save-v1`); never touches the kid star
  flags, and Josh's grown-ups reset never touches the fort.
- **Audio only via `JoshAudio.tone`** (the ONE iOS-safe path) + the global 🔇.
- **The engine is deterministic**: 30Hz fixed timestep, seeded RNG only (the
  `Math.random`-free rule is guardrail-scanned), plain-JSON state. That's the
  test strategy: node sims play whole levels headless (winnable by the scripted
  build, losable by neglect, wave tables audited against the budget curve), and
  the shipped `window.__TD` hooks (newGame/script/untilPhase/winL1) are the
  browser-test contract — the real-time analog of `data-correct`.
- Every `td-*` hash is **guarded** — locked visitors bounce to Josh's home;
  `main.js` wraps the fort in try/catch so a fort failure can never break
  Josh's site.

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

> **Ideas for more games** (all fit the RULE 5 guardrails + JOSH_PROFILE.md):
> ten-frame/teen build, set-the-clock, digraph (sh/ch/th) sort, dot-to-dot
> reveal, color-by-number, a simple xylophone (sound-on), peekaboo, more co-op
> modes layered onto existing games.

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
