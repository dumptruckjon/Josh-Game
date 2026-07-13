# Josh's Games — Engagement Audit #2: *visual & logic* (for the parent)

*Auditor lens: a curious 4.5-year-old, calibrated to Josh per
[`JOSH_PROFILE.md`](../JOSH_PROFILE.md). **Method: I opened ~25 games in a real
phone-sized browser (390×780) and looked at the actual pixels** — this is a
visual audit grounded in screenshots, not an inference from the code. It is the
companion to [`JOSH_AUDIT.md`](JOSH_AUDIT.md) (which covered *difficulty*); this
one asks the next question: **"Even where the difficulty is right, is the game
interesting to look at and interesting to think about?"** Snapshot: July 2026.*

> This is an honest proposal of what to improve next, not a status brag. It exists
> to steer the next build round and is wired to the self-healing standing rule
> (RULE 7): every fix below is proposed as a **shared framework upgrade + a
> guardrail test**, so it lifts *all* existing games and every future one at once.

> **✅ Plans A & B are now applied.**
> - **A#1 (systemic):** while a game is open the screen fills the viewport and the
>   stage **centres the play** (`safe center` — never clips tall games), with a soft
>   meadow **floor** at the bottom. Kills the dead bottom half on ~every game at once.
>   Locked by a guardrail so it can't silently regress.
> - **A#2:** a reusable reactive buddy — `api.mascot()` — that **cheers on a right
>   tap and wiggles on a miss**; wired into the flattest quizzes (all 7 sorters,
>   odd-one-out, add-up, first-sound, rhyme, read-zap, number-match). Guardrail-locked.
> - **A#3:** the flat white `.choice` cards are now **warmer (soft tint + friendly
>   outline) and squish deeper on tap** — applies to ~30 games.
> - **A#4 transformations:** *Add It Up*'s two groups now **slide together into one
>   pile you tap to count**; *Make Ten* **fills the empty cells to ten** on the right
>   answer; *Build the Number* **pops each new rod/bead** (it already built the
>   concrete tens/ones — honest note: that wasn't missing, the earlier screenshot
>   was its empty first frame).
> - **A#5:** *Color by Number* pictures are now **silhouettes on a background** (a
>   real Heart/Tree/House emerges) and each finish **reveals the thing you made** big.
> - **B#1:** the 2-bin sorters gained **tricky-but-true edge cases** (a snail/cactus
>   are alive; a robot/candle/watch are not) and **speak WHY** on every placement, so
>   a lucky guess still teaches. Truth table extended in lockstep.
> - **B#2:** *Which is Different?* now **escalates** — early rounds are a category
>   outlier, later rounds differ by **one feature** (three arrows up, one down).
> - **B#3:** the two-step "answer, then count it" beat is seeded on *Add It Up*.
>
> Everything is additive; the full unit + browser suite (Chromium + WebKit) stays
> green. The original audit below is kept for the record.

---

## 1. Headline verdict

The games are **correct, kind, and (after audit #1) mostly well-pitched in
difficulty. The gap now is *presentation and interaction texture*.** A 4.5-year-old
doesn't experience "difficulty" directly — he experiences *"is something happening
on the screen, and did my tap make something cool happen?"* Judged on that bar, the
collection splits sharply in two:

- **A minority of games are genuinely captivating** — a big character with a face,
  a scene, a build that visibly grows. `who-is-it`, `thwip-web`, `letter-maker`,
  `grow`, `color-number`, `team-count`, `big-red-one`, `music-pad`, `memory`.
- **The majority share one flat template** that is visually thin and
  interaction-thin at the same time.

**The single highest-leverage finding of this audit is that ~35 of the ~80 games
are the same "flat multiple-choice card" layout**, and that one template is
*simultaneously* the biggest **visual** weakness and the biggest **logic-engagement**
weakness. Fixing the template — not adding games — is the biggest possible win.

---

## 2. The root cause: the "flat MC template" (≈35 games)

Open `add-up`, `first-sound`, `odd-one-out`, `science-sort`, `read-zap`,
`place-value`, `rhyme`, `plane-shape`, `solid-match`, `continent-match`,
`count-feed`, `which-more`, `shadow-match`, `day-night`, `hot-cold`, `missing-letter`
… and you see the **exact same frame every time**:

```
┌─────────────────────────────┐
│  🏠      Title        👂/🔊  │
│      👀 👉 ❓  (icon strip)   │
│    "Tap the right one."      │
│        [ one picture ]       │   ← content lives in the TOP HALF only
│   [white] [white] [white]    │   ← plain white rounded cards
│                              │
│                              │   ← 30–50% DEAD SPACE, every time
│         (empty gradient)     │
└─────────────────────────────┘
```

Three problems compound here, and they're why these games feel "samey" to a kid:

1. **A dead bottom third-to-half.** Content is top-aligned inside `.game__stage`,
   so on a tall phone the lower 30–50% is empty gradient on the majority of games.
   Measured examples: `add-up` ≈45% empty, `first-sound` ≈40%, `odd-one-out` ≈40%,
   `science-sort` ≈45%, `place-value` ≈40%, `read-zap` ≈45%. The eye has nowhere
   to go; nothing lives in the bottom half where a thumb naturally rests.
2. **Plain white cards, no scene, no character.** The choices float as identical
   white rectangles on the gradient. There's **no "ground," no world, no mascot** —
   nothing that makes *this* game feel like a different place from the last one.
   Thirty games in a row look interchangeable.
3. **One-shot pick, then nothing transforms.** You tap, you get confetti, next
   round. The tap itself produces **no on-screen transformation** — the two flower
   groups in `add-up` never slide together into one pile; `place-value` shows the
   number "23" but no ten-blocks stack up; `make-ten` never *fills* anything you can
   see. The reward is bolted on (confetti) rather than *intrinsic* to the action.

**Why this matters for learning, not just polish:** the captivating games teach
*through* their visuals — `letter-maker` teaches letter formation *because* you
watch the U trace itself; `grow` teaches counting *because* the friend visibly gets
bigger; `thwip-web` themes the whole screen so the child stays in it. The flat
games teach *despite* their visuals. Josh will happily replay a game where his tap
makes the world change, and drift away from a white-card quiz — regardless of
whether the underlying question is at the right level.

### The contrast, in the app's own games

| Captivating (copy these) | Why it works |
|---|---|
| `who-is-it` | Colored **character faces**; the right card pops bright while wrong ones ghost out with stars — the screen *responds*. |
| `thwip-web` | A big Spidey **character** presides over a themed dark-web grid; you're *in a place*. |
| `letter-maker` | One huge trace-letter with a numbered dashed path fills the whole screen; the tap **builds** the letter. |
| `grow` | A **friend with a face** you visibly grow 1→10. (Starts too sparse — see §4 — but the mechanic is gold.) |
| `team-count` | A progress-dot track + a "Josh's turn!" banner + themed buttons — the screen has **state that fills up**. |
| `color-number` | A palette + a build-grid you fill in — a real **make-something** loop (its *reveal* is weak — see §4). |

| Flat (the template to upgrade) | What's missing |
|---|---|
| `add-up`, `first-sound`, `odd-one-out`, `read-zap`, `rhyme`, `which-more`, `shadow-match`, the 2-bin sorters, `count-feed`, `plane-shape`, `solid-match`, `continent-match`, `place-value`, `missing-letter` … | Dead bottom half; plain white cards; no character/scene; tap causes no transformation. |

---

## 3. Improvement plan A — **visual engagement** (systemic, lifts ~half the app)

These are framework-level changes so they apply everywhere at once and to every
future game (RULE 7). Ordered by leverage.

1. **Kill the dead space: center the play, add a "stage floor."**
   Change the shared `.game__stage` to vertically center its content (or anchor the
   choice row to the lower-middle), and add a subtle themed **ground band** at the
   bottom (a soft meadow/curve) so no game ever bottoms out into empty gradient.
   *One CSS change; visibly improves ~30 games. Guardrail: a mobile-test assertion
   that no game leaves >X% of the stage empty below the last element.*

2. **A reusable guide mascot: `api.mascot()`.**
   Give the framework an optional friendly character (JoshArt `numberFriend`/`kid`)
   that sits in the now-centered layout and **reacts** — a little bounce/nod on a
   right tap, a gentle "hmm, try again" wiggle on a soft-miss. Games opt in with one
   call. *Turns 30 anonymous quizzes into "playing with a buddy." Highest affection-
   per-effort lever.*

3. **Theme the cards, retire flat white.**
   Replace the plain `.game__choice` white rectangle with a warmer default (soft
   tint, thicker friendly border, a pressed-in "squish" on tap). Small change,
   applies to every MC game, instantly less clinical.

4. **Intrinsic transformation, not bolted-on confetti.**
   Add a shared `api.merge()`/`api.grow()` animation helper and use it where a game
   is *conceptually* a build:
   - `add-up`: the two groups **slide together into one pile** and count up 1…N.
   - `place-value`: tapping **+10 stacks a ten-rod**, +1 drops a unit-bead — he
     *sees* 23 as two rods and three beads, which is the actual Montessori point.
   - `make-ten`: a ten-frame **fills** as you add.
   *These are the exact games where the transformation *is* the concept — showing it
   is both better visuals and better teaching.*

5. **Give reveals a real payoff.**
   - `color-number`: as cells fill, a **recognizable picture emerges** (right now
     it's an abstract number grid — the "surprise picture" is the whole joy of
     color-by-number and it's currently missing).
   - Every "build" game ends by **presenting the finished thing** big for a beat
     before confetti.

6. **Fix the specific visual offenders (see §4).**

**Systemic wiring:** items 1–3 ship as framework/CSS defaults every game inherits;
a new `tests/mobile.test.js` guardrail fails any game that leaves the lower stage
empty, so future games can't regress into the flat template.

---

## 4. Specific per-game callouts (visual)

| Game | Problem (seen on screen) | Fix |
|---|---|---|
| **`continent-home`** ⚠️ *worst offender* | Three **tiny, identical gray blobs**, each with one small colored dot — indistinguishable, confusing, and the bottom ~50% is empty. A kid can't tell the maps apart. | Draw each continent as a **big, individually Montessori-colored shape** (the palette already exists in `CONTINENTS`); enlarge the animal; one map per card, clearly different colors. |
| **`grow`** | Great mechanic, but **starts as a tiny lonely friend floating in ~60% empty screen** with a "1" beneath it. | Add a **ground line + a ghost "10" goal outline** so the friend has a world and a visible target; consider starting a touch bigger. |
| **`landform-maker`** | **Grammar bug**: prompt reads *"Make a Island"* (should be *"an"*). Also the prompt appears **three times** (title + strip + big label) — cluttered. | Vowel-aware article ("a/an"); show the build label once. *(Fixed in this round — see below.)* |
| **`place-value`, `add-up`, `make-ten`** | Abstract: a number changes but **nothing visibly builds**. | Plan A#4 (stack rods/beads, merge piles, fill a ten-frame). |
| **`color-number`** | Fills a grid but **no picture emerges**; only 2 colors. | Plan A#5 (reveal a real picture); add a 3rd color later rounds. |
| **the 2-bin sorters** (`science-sort` alive/not, `day-night`, `hot-cold`) | Two big white bins; a **50/50 guess** with an obvious item (a *key* vs sprout/rock). Visually and cognitively thin. | See Plan B; add a "why" reveal image on placement. |

---

## 5. Improvement plan B — **logic engagement / still-too-easy**

Audit #1 already ramped many games; these are what a fresh 4.5-year-old pass
surfaces as *still* under-stimulating — now framed as engagement, not just difficulty.

1. **The 2-bin science sorters are the weakest thinking in the app.**
   `alive/not`, `day/night`, `hot/cold` are 50/50 with unmistakable items. Make
   3-bin the default sooner, pull in genuinely **edge-case items** (is a *seed*
   alive? is the *moon* day or night?), and add a one-line spoken "why" on each
   placement so a correct-by-guess tap still teaches.

2. **`odd-one-out` should escalate the *kind* of difference.**
   Round 1 (a rabbit among bugs) is a category outlier — obvious. Later rounds
   should keep the category constant and differ by **one feature** (four ladybugs,
   one facing the other way; four red, one blue) so it becomes real discrimination.

3. **Turn one-shot picks into 2-step micro-interactions.**
   The flat MC games end the instant he taps. A cheap depth win: after the pick, a
   **follow-up beat** — `add-up` → "now how many all together?" (tap the pile);
   `first-sound` → "tap another thing that starts with /k/." Two thoughts per round,
   not one, roughly doubles the thinking without adding a game.

4. **Per-round scaling on the remaining flat games** (the audit #1 pattern, applied
   wider): `first-sound`/`add-up`/`which-more` add a choice or climb their range each
   round instead of replaying round 1.

---

## 6. Prioritized roadmap (most impact first)

1. **Framework visual upgrade** (Plan A#1–3): center the stage, add the ground band,
   the reactive `api.mascot()`, themed cards + a guardrail test. *One build round,
   lifts ~30 games and every future game.*
2. **Intrinsic transformations** (Plan A#4–5) on the "build" games:
   `place-value`, `add-up`, `make-ten`, `color-number`. *Best visuals-and-learning-
   at-once win.*
3. **Fix the named offenders** (§4): `continent-home` maps, `grow` scene.
   *(landform grammar already fixed this round.)*
4. **Logic depth** (Plan B): sorter edge-cases + "why", `odd-one-out` feature-level
   differences, the 2-step follow-up beat.
5. **Wire each as a guardrail** so the flat template can't come back.

Everything above is additive — no game loses a feature; the flat games gain a floor,
a face, and a transformation.

---

*What's genuinely working and must be protected:* the character-driven games
(`who-is-it`, `thwip-web`, `grow`, `letter-maker`), the Find category (still the
model), the co-op bench, and the honest no-fail spirit. The problem isn't quality or
correctness — it's that **half the app uses one flat template that's thin to look at
and thin to poke at**, and that single template is the richest thing left to fix.
