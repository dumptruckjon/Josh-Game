// 📮 Delivery Day — the fourth New World (PLAN_TOWN.md §3): Josh drives the
// mail truck down a street of six houses and delivers four parcels. Each
// parcel shows who it is for; each house wears its address. The street climbs
// the reading ladder level by level:
//   1. Pets        — the parcel and the house show the same animal (match).
//   2. Letters     — the parcel shows a letter, the houses show letters.
//   3. Words       — the parcel shows a PICTURE, the houses show WORDS: he
//                    reads them to find it (his own decoding level, CVC).
//   4. Numbers     — the parcel shows DOTS, the houses show numerals: count.
// A wrong house wiggles and says what it is ("That house says dog"), which
// teaches; the right one gets its parcel and someone waves thank you.
//
// Levels are DATA; MailLogic.street deals a street (six addresses, four of
// them parcels, never two alike) and is proven in node to have exactly one
// right house per parcel.

(function (global) {
  "use strict";
  const PETS = [["🐶", "dog"], ["🐱", "cat"], ["🐰", "bunny"], ["🐸", "frog"], ["🐷", "pig"], ["🐻", "bear"], ["🦊", "fox"], ["🐮", "cow"]];
  const LETTERS = "ABCDEFGHJKMNPRSTW".split(""); // no I/L (alike on iOS), no O/Q (alike), no U/V (alike)
  // Every picture's natural four-year-old name IS its word (no 🐔 "hen": he
  // calls it a chicken; no 🐛 "bug": a caterpillar; no 📦 "box": the parcel
  // itself is a 📦). cat / hat / bat share a rime, so the word must be READ.
  const WORDS = [["🐱", "cat"], ["🐶", "dog"], ["☀️", "sun"], ["🚌", "bus"], ["🎩", "hat"], ["🐷", "pig"], ["🦊", "fox"], ["🦇", "bat"], ["🛏️", "bed"], ["🐟", "fish"]];
  const LEVELS = [
    { id: "pets", name: "Pets", icon: "🐶", kind: "pet" },
    { id: "letters", name: "Letters", icon: "🔤", kind: "letter" },
    { id: "words", name: "Words", icon: "📖", kind: "word" },
    { id: "numbers", name: "Numbers", icon: "🔢", kind: "number" },
  ];
  const HOUSES = 6, PARCELS = 4;
  const POOL = { pet: PETS.map((p) => p[1]), letter: LETTERS, word: WORDS.map((w) => w[1]), number: ["1", "2", "3", "4", "5", "6"] };
  function shuffle(a, rng) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  // Six different addresses down the street; four of them get a parcel, in a
  // shuffled order. Never two houses alike, so every parcel has ONE house.
  function street(kind, rng) {
    const addr = shuffle(POOL[kind].slice(), rng).slice(0, HOUSES);
    const parcels = shuffle(addr.slice(), rng).slice(0, PARCELS);
    return { addr, parcels };
  }
  const MailLogic = { LEVELS, PETS, LETTERS, WORDS, POOL, street, HOUSES, PARCELS };
  if (typeof module !== "undefined" && module.exports) module.exports = MailLogic;
  global.MailLogic = MailLogic;

  const T = global.Town;
  const doc = global.document;
  if (!T || !doc) return;
  const el = (tag, cls, html) => { const e = doc.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const pic = (list, name) => (list.find((x) => x[1] === name) || ["", ""])[0];
  const NOTES = [523.25, 659.25, 783.99, 1046.5];
  const PEOPLE = ["👵🏻", "👨🏽", "👩🏼", "🧒🏻", "👴🏾", "👧🏽"];
  const COUNT = ["", "one", "two", "three", "four", "five", "six"];
  // A parcel's dots are a DICE face (4 is a square, 5 has a middle), so he can
  // see how many at a glance as well as count them.
  const FACE = { 1: [[2, 2]], 2: [[1, 1], [3, 3]], 3: [[1, 1], [2, 2], [3, 3]], 4: [[1, 1], [1, 3], [3, 1], [3, 3]], 5: [[1, 1], [1, 3], [2, 2], [3, 1], [3, 3]], 6: [[1, 1], [2, 1], [3, 1], [1, 3], [2, 3], [3, 3]] };
  const DOTS = (n) => '<span class="mail-dots mail-dots--' + n + '" aria-hidden="true">' + FACE[n].map((rc) => '<i style="grid-row:' + rc[0] + ";grid-column:" + rc[1] + '"></i>').join("") + "</span>";

  // What an address or a parcel looks like, and how it is said.
  function face(kind, v, side) {
    if (kind === "pet") return '<span class="mail-pic" aria-hidden="true">' + pic(PETS, v) + "</span>";
    if (kind === "letter") return '<span class="mail-letter" aria-hidden="true">' + v + "</span>";
    if (kind === "word") return side === "parcel" ? '<span class="mail-pic" aria-hidden="true">' + pic(WORDS, v) + "</span>" : '<span class="mail-word" aria-hidden="true">' + v + "</span>";
    return side === "parcel" ? DOTS(+v) : '<span class="mail-num" aria-hidden="true">' + v + "</span>";
  }
  const spoken = { pet: (v) => "the " + v, letter: (v) => v, word: (v) => v, number: (v) => COUNT[+v] };

  function play(api, lv) {
    const st = street(lv.kind, api.rng);
    const scene = el("div", "mail-scene");
    const truck = el("div", "mail-truck", '<span class="mail-truck__van" aria-hidden="true">🚚</span>');
    const parcel = el("div", "mail-parcel");
    parcel.setAttribute("role", "img");
    truck.appendChild(parcel);
    // the parcels still in the truck after this one: it empties as he delivers
    const pile = el("div", "mail-pile", "📦".repeat(PARCELS - 1));
    pile.setAttribute("aria-hidden", "true");
    const head = el("div", "mail-head");
    head.append(truck, pile);
    const road = el("div", "mail-street");
    const houses = st.addr.map((a, i) => {
      const b = el("button", "mail-house tap",
        '<span class="mail-house__roof" aria-hidden="true"></span>' +
        '<span class="mail-house__sign">' + face(lv.kind, a, "house") + "</span>" +
        '<span class="mail-house__door" aria-hidden="true"></span>');
      b.type = "button";
      b.style.setProperty("--house", ["#ffd6c2", "#cfe8ff", "#d8f5c8", "#fff0b3", "#f3d6ff", "#ffe0e8"][i % 6]);
      b.setAttribute("aria-label", "House " + (lv.kind === "pet" ? "with a " + a : a));
      b.dataset.addr = a;
      road.appendChild(b);
      return b;
    });
    scene.append(head, road);
    api.stage.appendChild(scene);

    let k = 0, busy = false;
    const want = () => st.parcels[k];
    function show() {
      const v = want();
      parcel.innerHTML = '<span class="mail-parcel__box" aria-hidden="true">📦</span><span class="mail-parcel__tag">' + face(lv.kind, v, "parcel") + "</span>";
      parcel.setAttribute("aria-label", "A parcel for " + (lv.kind === "word" ? "the picture" : spoken[lv.kind](v)));
      api.next(houses.find((h) => h.dataset.addr === v));
    }
    const lines = {
      pet: (v) => "This parcel is for " + spoken.pet(v) + "! Which house?",
      letter: (v) => "This parcel says " + v + ". Find the house with " + v + "!",
      word: () => "Look at the picture on the parcel. Find the house with its word!",
      number: () => "Count the dots on the parcel! Which house has that number?",
    };
    const icons = { pet: "📦 ➡️ 🏠", letter: "🔤 ➡️ 🏠", word: "🖼️ ➡️ 📖 🏠", number: "⚫ ➡️ 🔢 🏠" };
    api.prompt(icons[lv.kind], "Delivery day! Four parcels to deliver. " + lines[lv.kind](want()));
    show();
    houses.forEach((h) => h.addEventListener("click", () => {
      if (busy || k >= PARCELS) return;
      if (h.classList.contains("mail-house--got")) { api.bump(h, "That house already has its parcel!"); return; }
      const v = want(), a = h.dataset.addr;
      if (a !== v) {
        const what = { pet: "That's the " + a + "'s house.", letter: "That house says " + a + ".", word: "That house says " + a + ".", number: "That's house " + COUNT[+a] + "." }[lv.kind];
        const again = { pet: "Find the " + v + "!", letter: "Find " + v + "!", word: "Find the word for the picture!", number: "Count the dots again!" }[lv.kind];
        api.bump(h, what + " " + again);
        return;
      }
      busy = true;
      api.next([]);
      const fly = el("span", "mail-fly", "📦");
      fly.setAttribute("aria-hidden", "true");
      truck.appendChild(fly);
      const g = api.gap(fly, h);
      api.move(fly, g.dx, g.dy, 550);
      api.later(() => {
        fly.remove();
        h.classList.add("mail-house--got");
        h.querySelector(".mail-house__door").textContent = PEOPLE[k % PEOPLE.length] + "👋";
        h.setAttribute("aria-label", h.getAttribute("aria-label") + ", has its parcel");
        k += 1;
        pile.textContent = "📦".repeat(Math.max(0, PARCELS - 1 - k));
        api.tone(NOTES[k - 1], { duration: 0.25 });
        const said = lv.kind === "word" ? "Yes! " + a.charAt(0).toUpperCase() + a.slice(1) + "! Thank you!" : lv.kind === "number" ? "Yes, " + COUNT[+a] + "! Thank you!" : "Thank you!";
        api.good(h, said);
        busy = false;
        if (k === PARCELS) {
          parcel.innerHTML = '<span class="mail-parcel__box" aria-hidden="true">📭</span>'; // the truck is empty
          parcel.setAttribute("aria-label", "Every parcel delivered");
          api.later(() => api.done("All four parcels delivered! Great job, mail carrier!"), api.reduce() ? 0 : 600);
          return;
        }
        show();
        api.later(() => api.say(lines[lv.kind](want())), api.reduce() ? 0 : 700);
      }, api.reduce() ? 0 : 560);
    }));
  }

  T.register({
    id: "mail",
    name: "Delivery Day",
    icon: "📮",
    color: "#d8f5c8",
    say: "Welcome to Delivery Day! Pick a street.",
    levels: LEVELS.map((l) => Object.assign({ doneIcon: "📬" }, l)),
    play(api, level) { play(api, level); },
    logic: MailLogic,
  });
})(typeof window !== "undefined" ? window : globalThis);
