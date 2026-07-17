# Backlog — what's left to build

Durable notes so a fresh session (human or AI) starts with full context. Read
this alongside [`../CLAUDE.md`](../CLAUDE.md) (how to build & ship) and
[`../JOSH_PROFILE.md`](../JOSH_PROFILE.md) (who Josh is & what to build).

Everything below came out of a multi-agent brainstorm of where to take the app
next. The scannable decision-doc version (themes, tiers, scores) is a private
Artifact on claude.ai:

- **Roadmap artifact:** https://claude.ai/code/artifact/d7dfba68-1192-4536-abf0-75692372e52b

The plan was sequenced into three waves. **Waves 1 & 2 and most of Wave 3 are
shipped and live.** What remains is below.

---

## ✅ Shipped (all live on `main`, CI-verified)

- **Wave 1 — reward + sound:** 📖 Sticker Book (one slot per game, plops on win)
  + centralized mute-gated audio cues (`JoshAudio.winCue/goodCue/bumpCue`).
- **Wave 2 — Buddy pipeline:** `JoshBuddy` (`josh-buddy`) — pick a companion once;
  it appears on the home screen AND stars in every win celebration.
- **Wave 3 (partial):**
  - Adaptivity engine — `api.shouldRamp()` (invisible mastery-based difficulty).
  - New games: **Thwip the Villains**, **Read & Do** (decodable sentences),
    **Listen & Answer** (oral comprehension).
  - Difficulty tiers: **half-past clock** (`:30`), **4×4 Picture Squares**,
    **mastery-based science sorters**.
  - Fixes: Piggy Bank win-total display, Look From Above occlusion, the ⚽
    2D-circle-vs-3D-ball contradiction (+ a guardrail forbidding any emoji being
    both a plane shape and a solid).

A deep 21-lane correctness audit of all 78 games (weighted to the above) found
**no regressions** from this work — only the two small pre-existing content nits
listed as fixed above.

---

## 🔲 Remaining Wave 3

- **Scratch & Find** — a drag-to-erase reveal (fog on a `<canvas>` you smear away
  to uncover a friend/pup). *Drag/pointer mechanic → needs bespoke pointer-event
  tests + careful iOS touch handling; do NOT force it into the tap-based harness.*
  Note: its reveal idea overlaps the existing **Web Rescue** / **Peekaboo**, so
  marginal novelty is lower — the drag *feel* is the point.
- **Big-Piece Jigsaw** — slice an existing `JoshArt` SVG into 4→6 chunky pieces
  to drag into a silhouette. *Also drag-based; same testing caveat.*
- **On-ramp scaffolding** — **RECOMMEND DROP.** The games it targeted already open
  at their easiest round, and the one truly-too-hard game (Look From Above) was
  fixed directly. Adding it now would be a speculative change (against the
  "improvements-not-speculative-changes" standing rule) unless a concrete
  round-0 frustration point is identified first.

## 🔲 Extras from the brainstorm (never sequenced into the waves)

- **Universal "tap-to-hear-its-name"** — a centralized `JoshAudio.sayName()` so
  tapping any picture speaks it across games (and isolates its first sound in
  literacy games). *High impact, medium effort — the highest-value extra.*
- **Make-Your-Own-Guy** — a custom-character maker built from `JoshArt.friend()`
  parts that feeds the buddy pipeline. *The buddy plumbing already exists, so
  this is now easier.*
- **Spidey's Day** — a tap-a-path picture story (first taste of narrative/sequencing).
- **Small audio quick-wins** (all via the iOS-safe `JoshAudio.tone`): a per-count
  "BLOOP" (rising pitch) in counting games; a **Silly Sounds** toy; animal
  *sounds* in Hi Animals (it currently speaks the name but plays no animal sound).

## 🎯 APPROVED DIRECTION — "Road to 100 stickers" slate (July 2026 brainstorm)

Goal: 84 → **100 games**. 16 core ideas, all tap-only / no-fail / harness-ready,
each filling a VERIFIED gap (grep-checked absent from the catalog):

- **Science:** 🎨 Mix It! Paint Lab (color mixing, predict the result) ·
  🛁 Sink or Float? (predict→test) · 🌱 Plant or Animal? (sorter engine) ·
  🐣 Mama & Baby (match baby↔mama)
- **Numbers:** 🍪 Fair Shares (deal cookies equally — early division + fairness) ·
  👀 Quick Peek (subitizing behind a self-paced cloud, NO timer)
- **Letters:** 🚂 Alphabet Train (letter ORDER: A B _ D) · 🔎 Letter Hunt
  (pop every matching letter balloon — goes in Find It)
- **Thinking:** 🧩 Which Piece Fits? (tap-only jigsaw / geometry cabinet) ·
  ☁️ Who Hid? (what-disappeared working memory) · 🥁 Copy My Beat
  (echo a 2–3 drum sequence — order only, never timing)
- **Calm & Friends (his real SEL edges, currently 0 games):** 😊 How Do They
  Feel? (feeling faces + a helping breath) · 🤝 Kind Helpers (tap the kind
  choice) · 📅 Day Train (days of the week)
- **Fun & Play:** 🌦️ Dress Me! (weather → the friend visibly gets dressed) ·
  🌈 Season Windows (match scenes to seasons)

Alternates: 📏 Longer or Shorter? (measurement) · 🥛 Where From? (food origins).
Bar for every one: picture names itself, spoken+icon prompts, a visible
transformation as the reward, one unit-tested logic.js function, and a
content.test.js truth table (mix results / float facts / pairs / day order /
feeling mappings) so no answer can silently go wrong.

## 🚫 Deliberately avoid

- **Real Faces & Real Things** (parent-uploaded photos populating the games).
  Scored "transformative" in the brainstorm but flagged to avoid: it drags
  IndexedDB, a file-input privacy surface, and PII into a dependency-light static
  site. Defer, or keep strictly optional + device-only if ever attempted.

## ℹ️ Already done — do NOT rebuild (verified in code)

- **Peekaboo → real friends** — already reveals friend/hero SVG art.
- **Spell My Friends** — `name-spell` already rotates the friends' names
  (`content.js` `NAMES`), not just JOSH.
- **Themed wins / "who's playing"** — delivered via the Buddy pipeline.
