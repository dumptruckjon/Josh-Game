# 🎮 Josh Profile — seed for building games

**Purpose.** A portable, self-contained profile of **Josh (age 4)** for generating age-appropriate,
personalized games. Feed it to whatever builds games in this repo (a CLAUDE.md, a system prompt, a data
file). It's distilled from an active Montessori worksheet project that has shipped dozens of validated
worksheets calibrated to Josh's real school assessment — so the skill levels and design rules here are
*battle-tested*, not guesses.

> **🔒 Privacy note (public repo).** This file intentionally contains **no personally-identifying info
> beyond first names**. No last names, home address, phone numbers, birth year, or school/teacher names.
> If you build a "learn my address / phone" safety-practice game, **inject those private values at runtime
> and never commit them.** Keep it that way.

**Provenance / freshness.** Skill levels come from Josh's **Montessori progress report, June 2026**
(Primary / Level 2, age 4). Re-sync whenever a newer report arrives — the skill map is the part that
changes. Companion machine-readable data: [`josh-profile.json`](josh-profile.json).

---

## ⭐ TL;DR — the 5 rules that make or break a Josh game

1. **He can barely read.** Instructions must come from **audio narration + pictures + a demonstrated
   example** — never from text he has to decode. If a game only works once a grown-up reads it aloud, it
   failed. (Games have a superpower worksheets didn't: **voice**. Use it as the primary instruction channel.)
2. **The activity IS the reward.** Doing the task should *visibly transform something* — a correct answer
   makes a picture appear, suits up a hero, lights a constellation, moves a friend closer to home. Reward
   art bolted on the side (bare stars/coins/bars) is the weakest lever.
3. **He loves puzzles *with friends*.** A **2-player / co-op** mode (take turns, race or build together,
   no referee needed) is the single biggest engagement win. Nothing beats this for Josh.
4. **Protect his frustration tolerance.** Handling frustration & self-confidence are his growth edges —
   so **no hard-fail / no "you lose" states.** Gentle retries, celebrate effort, offer a calm-down beat.
5. **Ease him into anything new.** He thrives in *familiar* formats and needs gentle onboarding for
   unfamiliar ones (teacher's note). New mechanics need a slow, worked walkthrough the first time.

**Difficulty dial:** aim ~**70% Challenge** (his `[W]` "Working" edges — the sweet spot) / ~**30% Confidence**
(his `[M]` "Mastered" skills — the reward/calm slice), and sprinkle in a *gently-scaffolded* `[P]` new skill.

---

## 👦 Who Josh is

- **Name:** Josh (first name only in this repo).
- **Age:** 4.
- **Birthday theme:** **Feb 14 (Valentine's Day)** — a fun, low-risk hook for birthday/themed games.
- **Heritage:** half White / half Chinese — noted only for **inclusive character design** (so heroes and
  helpers can look like him and his friends).
- **Loves learning**, very observant, curious, socially warm, plays well with peers and adults.
- Attends a **Montessori preschool** (Primary / Level 2).

### Best friends (all age 4) — rotate them through games so it feels personal, never repetitive
| Friend | Heritage (for character design) |
|---|---|
| **Raegar** | Indian / Russian |
| **River** | Chinese |
| **Viraj** | Indian |

> **Reusability rule:** weave a *different* friend into each game/level's story, characters, and co-op
> "other player." Vary the *content* too (scenes, counts, word lists), not just the name.

### 🔒 Personalization — what's safe here vs. what to inject privately
- **Safe to use in this public repo:** first name (Josh), the Feb-14 birthday theme, friends' first names,
  interests.
- **Keep OUT of this repo (inject privately at runtime if ever needed):** last name, home address, ZIP,
  phone numbers, school/teacher names. Learning to recite one's address & phone is a genuine Montessori
  safety skill — so a "say my address / phone" practice game is welcome, but its answer values must be
  supplied privately by the parent, never hard-coded or committed here.

---

## 🕷️ Interests & theming palette (reskin freely)

Josh's two big loves — use them as the visual/character skin over any mechanic:

- **Spidey & His Amazing Friends** (preschool Marvel). Character roster to reskin heroes/helpers:
  **Spidey** (Peter), **Ghost-Spider / Gwen** 🕸️, **Spin** (Miles). Villains are gentle (Green Goblin,
  Rhino, Doc Ock) — keep them silly, never scary. Great for "suit up the hero," "web-swing path,"
  "team-up rescue" framings.
- **Numberblocks** (numbers 1–10+ as friendly block characters). *Perfect* for math — a Numberblock
  literally grows/builds as Josh counts or adds. Use for counting, place value, addition, teen numbers.

Secondary interest hooks: **puzzles**, **space/stars** 🌟 (constellation reveals landed well),
**animals**, **vehicles** 🚗🚌🚀, **his Feb-14 birthday**.

Tone: bright, friendly, celebratory, silly-not-scary, lots of "you did it!" energy.

---

## 🚸 The #1 design law: built for a non-reader (adapted for screens)

Everything below is how the worksheet project keeps tasks doable for Josh — translated to interactive games.

- **Audio-first.** Every instruction/prompt is **spoken aloud** (tap a 🔊 to replay). Text on screen is
  for the accompanying grown-up, not for Josh. Keep any child-facing words to a single short phonetic
  word he might decode (he *can* read 3–4 letter phonetic words — cat, dog, sun — [M]).
- **Icon instruction strip, not a sentence.** Lead each task with 2–3 big icons showing the action
  (e.g. 👀 → ✏️ → 😊). The pictures carry the meaning on their own.
- **Show, don't tell — a worked example first.** Pre-complete/animate the first item as a demo so he
  copies the pattern. One shown example teaches more than any sentence.
- **The shape of the task is the instruction.** A dashed line begs to be traced; a ghosted gray picture
  begs to be completed/colored; a green ▶ start dot → red ⏹ stop dot shows a path's direction. Reuse the
  same visual language every time so he learns it once.
- **Pictures, not word problems.** Show `🟥 + 🟦 = ?` with real countable objects, never "River had 1
  block…". Put the answer's control-of-error in the *concrete* (countable objects, 1:1 matches, the
  picture that names the word) so he self-checks by re-counting/re-saying, not by reading.
- **One task per screen.** Never mix two activities that each need explaining.
- **Picture must name itself.** On any "name the picture" task (first sound, rhyme), the picture's natural
  4-year-old name must BE the answer. Avoid ambiguous icons where the obvious name ≠ the intended word
  (e.g. a chicken emoji for "hen", a soccer-ball for "ball", thumbs-up for "thumb"). If he'd say a
  different word than you keyed, pick a clearer picture.

---

## 🎇 Engagement principles (in priority order)

1. **Transformation over decoration.** Build the reward INTO the task — the math completes a picture,
   colors in a ghosted hero, or moves a friend home. The reward art must never *carry the answer*
   (control of error stays concrete/countable so he can't just copy).
2. **2-player / co-op whenever natural.** Two lanes, take turns, race-or-build-with a friend/parent. A
   turn indicator (🕷️ vs 🕸️) shows whose go it is so no adult has to referee. *His top lever.*
3. **Personalize cheaply.** His Feb-14 birthday, his friends, his heroes — near-zero cost, big lift.
   Rotate per game.
4. **Autonomy & identity, especially on hard days.** Pick-your-hero, build-your-own, an "I did it!"
   certificate he "signs," a calm-down breathing beat. Pair one with any challenge-heavy game to protect
   frustration tolerance.
5. **Respect the 4-year-old ceiling.** Short sessions (~5–10 min of focus), big tap targets, forgiving
   input, no time pressure unless it's a gentle friendly race.

---

## 📚 Skill map & difficulty calibration (THE part that drives "relevant" games)

Legend: **[M]** Mastered → confidence/reward slice · **[W]** Working → the *challenge sweet-spot* ·
**[P]** Presented → brand-new, scaffold gently · **[NA]** Not yet assessed → treat as brand-new/optional.

### 🔢 Math
- **Mastered [M] (build confidence, use as the fun/reward slice):** 1:1 correspondence · rote count 1–10 ·
  recognize numerals 1–10 · quantify 1–10 · number sequence 1–10 · **write numbers independently** ·
  **teen board 11–19** · **ten board 10–100** · **count by 10s** · simple addition (bead stairs) ·
  intro to golden beads / decimal cards.
- **Working [W] (CHALLENGE — his live growth edges, spend most math games here):** **count by 5s** ·
  **count by 2s** · **2-digit addition** · **golden-bead fetch** (build a 2-digit quantity) ·
  **bird's-eye view** (top-down/spatial).
- **Presented [P] (introduce gently, one new idea at a time):** **simple subtraction** (take-away) ·
  **clock & time** (analog o'clock / half-past).
- **Not assessed [NA] (BRAND NEW — big opportunity, scaffold from zero):** **money / coin values.**
  Start with "a penny = 1¢, count the pennies," then nickels = 5¢, then "which pile is worth more."
  Never assume prior coin knowledge.

### 🔤 Language & Literacy
- **Mastered [M]:** knows common words · letter **sounds** · **beginning sounds** · **decodes 3- & 4-letter
  phonetic words** (cat, dog, frog) · **interprets pictures** (his superpower — lean on it) · fills in
  words / "reads" familiar books from memory · comprehends read-aloud text.
- **Working [W] (CHALLENGE):** **rhyming** · **sight (non-phonetic) words** (the, was, you) ·
  **phonograms / digraphs** (sh, ch, th) · **reading simple sentences** · **comprehension** ·
  **writing name / lowercase letters** · **writing simple words & sentences**.
- **Keep connected text audio-supported.** A single short phonetic word + picture is fair game and builds
  confidence; a sentence to *read* should be spoken aloud (audio) with the picture doing the work.

### 🗺️ Geography, Science & Sensorial
- **Mastered [M]:** matching · sorting · grading sizes · puzzles · binomial cube · days of week · months ·
  seasons · land/air/water · continent globe · continent map (whole). **Science, all [M] and UNDER-USED —
  a great fresh domain:** living/non-living · plants/animals · magnetic/non-magnetic · sink/float.
- **Working [W] (CHALLENGE):** the **six individual continent maps** (N. America, S. America, Europe,
  Australia, USA, Asia) · **geometry solids** · **geometry cabinets** · **trinomial cube**.
- **Presented [P] (gentle):** **landforms** (island/lake/peninsula/gulf) · **oceans**.

### ✋ Practical Life, Motor & Social-Emotional
- **Mastered [M]:** scissors (straight/curved) · glue · **all dressing frames except lacing** (buttons,
  snaps, zips, velcro) · **pencil grip, tracing, coloring inside lines, draw circle/line** · pegboard,
  pinning, lids, nuts & bolts · **all gross motor** (hop, skip, gallop, walk backwards, throw, balance).
- **Working [W] (CHALLENGE / grow):** **lacing** (the one fine-motor edge — thread/trace paths) ·
  writing his **name and personal details** (name/address/phone — inject any private values at runtime,
  never commit them) · **self-confidence** · **handling frustration (deep breathing)** ·
  **conflict resolution** · **group discussion / turn-taking**.
- **Design implication:** because tracing/coloring/cutting are *mastered*, use them as **calm/confidence
  fillers**, not as a game's main challenge. Because frustration & confidence are *working*, build in
  no-lose design + celebration + calm-down beats.

### 🧠 Logic & Reasoning (newly introduced via worksheets — screen-native winners)
Introduced recently and landed well; ideal for games: **odd-one-out** · **picture-sudoku (4×4)** ·
**sequencing / put-in-order** · **spot-the-difference** · **shadow / silhouette matching** ·
**dot-to-dot reveal** · **color-by-code mystery picture** · **pattern "what comes next."**
Treat as `[P]→[W]`: scaffold the first time, then they become favorites.

---

## 🕹️ Game mechanic menu (skill → concrete game idea, tagged by difficulty)

Reskin any of these with Spidey / Numberblocks / a friend. ★ = especially strong fit for Josh.

**Math**
- ★ **Count-and-feed / count-and-tap** — count N objects to feed a monster or fill a truck. `[M]` counting.
- ★ **Numberblock builder** — stack exactly N blocks; the block character grows as he counts. `[M]`/`[W]`.
- **Finger-trace the numeral** — trace 0–9 with a finger; it animates to life. `[M]` writing.
- **Skip-count hop** — a hero hops along stones by 2s or 5s; fill the missing numbers. `[W]`.
- ★ **Golden-bead / place-value build** — drag ten-bars + ones to build a 2-digit number. `[W]`.
- **Combine two groups** (2-digit addition) — merge bead piles, count the total. `[W]`.
- **Take-away animation** — objects hop away; count what's left. `[P]` subtraction.
- **Set-the-clock / daily-routine order** — drag the hour hand; sequence wake→school→bed. `[P]` time.
- ★ **Coin shop (NEW)** — count pennies to "buy" a sticker; nickel = 5 pennies. Scaffold hard. `[NA]` money.
- **Ten-frame fill / teen build** — fill 10 + some more; name the teen. `[M]`/`[W]`.
- **More/fewer, taller/shorter, heavier/lighter** — tap the bigger group / taller thing. `[P]` compare/measure.

**Literacy**
- ★ **First-sound sort** — drag pictures under their starting letter (audio says the picture). `[M]`.
- **Build-a-word (CVC)** — tap 3 letter-sounds to spell cat/dog/sun under a picture. `[M]`.
- ★ **Rhyme match** — connect two rhyming pictures (audio names them). `[W]`.
- **Sight-word pop** — hear a word, tap the matching one of 3. `[W]` (audio-supported).
- **Digraph sort (sh/ch/th)** — sort pictures by their letter-team sound. `[W]`.
- **Listen-and-answer / picture-story sequence** — hear a 2–3 line story, tap the picture answer. `[W]` comp.

**Geography / Science / Sensorial**
- ★ **Drag-the-continent to the globe** / trace & color a continent; "where do WE live?" star. `[W]` maps.
- **Land/water & landform sort** — color/sort island, lake, ocean. `[P]`.
- ★ **Science sorter (fresh!)** — living vs non-living, plant vs animal, sink vs float, magnetic vs not.
  All `[M]` → confidence wins + you can push to trickier examples.
- **Calendar games** — days/months/seasons order & match. `[M]`.
- **3D-solid ID / shape-hole match** — match cube/cone/sphere to its real-world object. `[W]` solids.
- **Jigsaw puzzles** — his mastered love; any theme. `[M]`.

**Logic & Reasoning** ★ (whole strand is a strong screen fit)
- Odd-one-out · picture-sudoku 4×4 · put-in-order sequencing · spot-the-difference · shadow match ·
  pattern "what comes next" · dot-to-dot reveal · color-by-number mystery picture.

**Fine-motor / calm / SEL**
- **Lacing / trace-the-path maze** — green start → red stop, follow the dashed trail. `[W]` lacing.
- ★ **Breathing star / calm corner** — trace a star slowly, breathe in on up-strokes; a no-wrong-answer
  reset for hard moments. Serves frustration-handling `[W]`.
- ★ **"I did it!" certificate** — "sign" his name, color a badge, celebrate finishing. Autonomy/confidence.

**Co-op / 2-player** ★ (layer onto ANY of the above)
- Two lanes, take turns, race a friend/parent home; or a cooperative build where both players add pieces
  to a shared goal (no losing → protects frustration tolerance). His single best engagement lever.

---

## 📱 Input & accessibility for a 4-year-old (game UX)

- **Primary instruction = voice.** Auto-play a short spoken prompt; a persistent 🔊 replays it. Never gate
  progress on reading.
- **Big tap targets, forgiving hit-boxes.** He's 4 — generous sizes, no tiny buttons.
- **Simple gestures only.** Tap and single-finger drag/trace are reliable (fine-motor mostly `[M]`).
  Avoid multi-touch, pinch-zoom, precise timing, or fast reflex challenges.
- **Immediate, celebratory feedback.** Correct → a happy sound + a *visible transformation*. Wrong →
  gentle "try again" (a soft bump, never a buzzer-of-shame), keep the object in play, no score loss.
- **No hard-fail, no timers-that-punish.** If a friendly race timer exists, losing still ends in "great
  try, play again!" Never a game-over screen.
- **Short levels.** ~5–10 min of focus; let him stop anytime with progress saved.
- **Onboard new mechanics slowly.** First encounter with an unfamiliar game type = a guided, worked
  walkthrough (he needs easing into new formats); familiar formats can jump straight in.

---

## 🚫 Things to avoid (learned the hard way)

- **Text-dependent instructions.** Anything that only works if he reads it. (Use audio + icons + demo.)
- **Ambiguous pictures on naming tasks.** If the obvious 4-year-old name of an icon ≠ the intended word,
  the task teaches nothing. Verify the picture names itself.
- **Hard-fail / "you lose" / shame feedback.** Directly harms his `[W]` frustration tolerance.
- **Precise/fast input** (pinch, drag-drop with tiny targets, reaction-time). His motor + age can't.
- **Word problems / story math to be read.** Show countable pictures instead.
- **Brand-new mechanic with no onboarding.** He needs a gentle first-time walkthrough.
- **Assuming money knowledge.** Coins are `[NA]` — start from zero.
- **Repetition across sessions.** Rotate friends, themes, scenes, and number/word sets so no two games
  feel like the same photocopy.

---

## 🔁 How to keep this current
- The **skill map** is calibrated to the **June 2026** assessment. When a newer report arrives, re-bucket
  skills into `[M]/[W]/[P]/[NA]` and bump the challenge/confidence targets. Everything else (non-reader
  law, engagement principles, friends, interests) is stable.
- The private companion worksheet-factory project holds the raw assessment and the full design spec; keep
  those (and any real personal details) out of this public repo.
