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
measured gap is unchanged. When you fix the next thing, extend this list.

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
│   ├── art.js                  # window.JoshArt — original homage SVG (hero/pup/numberFriend/friend/truck/rocket/…)
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
│   └── main.js                 # Launcher (category menu + Surprise tile + 📖 Sticker Book + ⭐ badges) + hash router + sound + SW
├── tests/
│   ├── site.test.js            # node:test structure/wiring/content/guardrail checks (no browser)
│   ├── content.test.js         # CORRECTNESS: ground-truth restatement — answers can't silently go wrong
│   ├── hl-content.test.js      # 华丽 CORRECTNESS: poems/idioms/zodiac/量词/festivals/dishes/seasons truth tables + gate + FU_PATH tap geometry
│   ├── logic.test.js           # deep unit tests of scripts/logic.js (seeded RNG, exhaustive)
│   ├── e2e.test.js             # Playwright (Chromium) — GENERIC harness that plays EVERY registered game
│   ├── mobile.test.js          # Playwright iPhone (real WebKit in CI) — overflow + ≥75px audit on home AND every game
│   └── helpers.js              # shared: locate a browser + serve the site (or JOSH_BASE_URL for live)
├── package.json                # `npm test` → `node --test` (runs unit + e2e + mobile)
├── package-lock.json           # committed for reproducible `npm ci` in CI
├── .gitignore                  # ignores node_modules etc.
├── .github/workflows/
│   └── deploy.yml              # CI: test (unit+e2e+WebKit) → deploy (cache-busts assets) → verify-live
├── JOSH_PROFILE.md             # WHO JOSH IS: skill levels, non-reader law, friends, interests, game-mechanic menu — READ before building
├── josh-profile.json           # ^ same profile, machine-readable (for programmatic game generation)
├── PLAN_ROAD_TO_140.md         # Set 1 build plan (40 games, waves W1-W4) — ✅ BUILT (Josh at 140)
├── PLAN_ROAD_TO_180.md         # Set 2 build plan (40 MORE: pick-place, toggle-match, reveal, co-op echo, waves W5-W8) — ✅ BUILT (Josh at 180)
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

**180 games** across Josh's skill map (see `JOSH_PROFILE.md`), each on the
shared framework, all no-fail / no-timer / ≥75px targets — and every one
winnable, so the 📖 Sticker Book tops out at a full ⭐ 180/180. The home screen is a
menu of **7 categories** (icons carry the meaning); tapping one opens that
category's games. (Set 2 — the last 40 — added six NEW interaction shapes:
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
  compare), **Partner Up!** (pair the ducks → even or odd).
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
  assembles).
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
  distinct silhouettes only).
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
  (position-word clues assemble a chest).
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
  scrub → rinse → dry, the car visibly cleans up).
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
  Hearts** (gratitude — every choice is right).

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
  Sticker Book counts only his 180, hers only her 40 (both guardrail-tested).
- **Correctness bar is identical:** `tests/hl-content.test.js` restates the
  cultural ground truth (the 5 Tang poems verbatim, real idioms + forged-idiom
  check on distractors, 生肖 order, standard 量词 pairs, festival↔custom bins
  with no dual-membership, regional dish↔city, season membership, the waxing
  moon, 宫商角徵羽 ascending) so no answer can silently go wrong.
- Nav screens bounce to Josh's home without the session flag; game screens stay
  deep-linkable (the harness needs them, and a non-reader can't type a hash).
  Her name gate is `data-adult` (adult-sized controls, exempt from the kid audit).

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
