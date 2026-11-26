// 🍳 Little Kitchen — the second New World (PLAN_TOWN.md §3): Josh cooks from
// PICTURE recipes. A recipe card shows each step as a picture and a count
// (🍓 ×3); he taps the right thing on the counter that many times, the bowl or
// pan changes with every tap, and the dish is served to a friend who says yum.
// Counting, sequencing and following a recipe (Montessori practical life).
// Grandma's dumplings count in CHINESE (一 二 三 …) and she says 好吃.
//
// A recipe is DATA (steps: a tool and how many taps); one engine plays them
// all through the New Worlds shell: api.next marks the tool to tap, a wrong
// tool wiggles and says which one comes next.

(function (global) {
  "use strict";
  const T = global.Town;
  if (!T) return;
  const doc = global.document;
  const el = (tag, cls, html) => { const e = doc.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

  // What is on the counter. `say` is how a step names it ("three strawberries").
  const TOOLS = {
    straw: { pic: "🍓", label: "Strawberries", one: "strawberry", many: "strawberries", add: "🍓" },
    banana: { pic: "🍌", label: "Bananas", one: "banana", many: "bananas", add: "🍌" },
    grape: { pic: "🍇", label: "Grapes", one: "bunch of grapes", many: "bunches of grapes", add: "🍇" },
    egg: { pic: "🥚", label: "Eggs", one: "egg", many: "eggs", add: "🥚" },
    milk: { pic: "🥛", label: "Milk", one: "cup of milk", many: "cups of milk", add: "🥛" },
    flour: { pic: "🌾", label: "Flour", one: "scoop of flour", many: "scoops of flour", add: "🌾" },
    spoon: { pic: "🥄", label: "Spoon", one: "stir with the spoon", say1: "a stir with the spoon", act: "stir", verb: "give it" },
    pan: { pic: "🍳", label: "Pan", one: "pancake", many: "pancakes", act: "cook", verb: "cook" },
    dough: { pic: "⚪", label: "Dumpling skins", one: "dumpling skin", say1: "the dumpling skins", act: "skins", verb: "lay out" },
    fill: { pic: "🥬", label: "Filling", one: "dumpling", many: "dumplings", act: "fill", verb: "fill" },
    pot: { pic: "🍲", label: "Pot", one: "pot", say1: "the pot", act: "boil", verb: "put them in" },
    sauce: { pic: "🍅", label: "Tomato sauce", one: "tomato sauce", say1: "the tomato sauce", act: "sauce", verb: "spread" },
    cheese: { pic: "🧀", label: "Cheese", one: "cheese", say1: "the cheese", add: "🧀" },
    mush: { pic: "🍄", label: "Mushrooms", one: "mushroom", many: "mushrooms", add: "🍄" },
    olive: { pic: "🫒", label: "Olives", one: "olive", many: "olives", add: "🫒" },
    oven: { pic: "🔥", label: "Oven", one: "oven", say1: "the oven", act: "bake", verb: "put it in" },
  };  const COUNT = ["", "one", "two", "three", "four", "five", "six"];
  const ZH = ["", "一", "二", "三", "四", "五", "六"];
  const NOTES = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66];
  const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
  // What to DO on a step, said aloud: "add four strawberries", "cook four
  // pancakes", "fill five dumplings" (a thing to add has no verb of its own).
  const todo = (tool, n) => (tool.verb || "add") + " " + many(tool, n);
  const many = (tool, n) => (n === 1 ? tool.say1 || (/^[aeiou]/.test(tool.one) ? "an " : "a ") + tool.one : COUNT[n] + " " + tool.many);

  // Each recipe: who eats it, the dish, the counter, and the steps. A step's
  // `n` may be a range [lo, hi], drawn once per play from the shell's rng.
  const RECIPES = [
    { id: "salad", name: "Fruit Salad", icon: "🥗", doneIcon: "🥗", dish: "🥗", eater: "River", vessel: "bowl",
      tools: ["straw", "banana", "grape", "spoon"],
      steps: [{ t: "straw", n: [2, 4] }, { t: "banana", n: [1, 3] }, { t: "grape", n: [1, 2] }, { t: "spoon", n: 1 }] },
    { id: "pancakes", name: "Pancakes", icon: "🥞", doneIcon: "🥞", dish: "🥞", eater: "Raegar", vessel: "bowl",
      tools: ["egg", "milk", "flour", "spoon", "pan"],
      steps: [{ t: "egg", n: 2 }, { t: "milk", n: 1 }, { t: "flour", n: [1, 2] }, { t: "spoon", n: 1 }, { t: "pan", n: [2, 4] }] },
    { id: "pizza", name: "Pizza", icon: "🍕", doneIcon: "🍕", dish: "🍕", eater: "Viraj", vessel: "dough",
      tools: ["sauce", "cheese", "mush", "olive", "oven"],
      steps: [{ t: "sauce", n: 1 }, { t: "cheese", n: 1 }, { t: "mush", n: [2, 4] }, { t: "olive", n: [2, 3] }, { t: "oven", n: 1 }] },
    { id: "dumplings", name: "Grandma's Dumplings", icon: "🥟", doneIcon: "🥟", dish: "🥟", eater: "Grandma", eaterPic: "👵🏻", vessel: "board", zh: true,
      tools: ["dough", "fill", "pot"],
      steps: [{ t: "dough", n: 1 }, { t: "fill", n: [3, 5] }, { t: "pot", n: 1 }] },
  ];

  function faceOf(r) {
    const C = global.JoshContent, Art = global.JoshArt;
    const f = r.eaterPic ? null : C && C.FRIENDS && C.FRIENDS.find((x) => x.name === r.eater);
    if (f && Art && Art.friend) { try { return Art.friend(f.art); } catch (e) { /* fall back */ } }
    return r.eaterPic || (f && f.emoji) || "🙂";
  }

  function play(api, r) {
    const rng = api.rng;
    const steps = r.steps.map((s) => ({ t: s.t, n: Array.isArray(s.n) ? s.n[0] + Math.floor(rng() * (s.n[1] - s.n[0] + 1)) : s.n }));
    const scene = el("div", "kit-scene");
    // the recipe card: a picture and a count per step
    const card = el("div", "kit-card");
    card.setAttribute("role", "img");
    card.setAttribute("aria-label", "The recipe: " + steps.map((s) => many(TOOLS[s.t], s.n)).join(", "));
    const cells = steps.map((s) => {
      const c = el("span", "kit-step", '<span class="kit-step__pic" aria-hidden="true">' + TOOLS[s.t].pic + "</span>" +
        (s.n > 1 ? '<span class="kit-step__n">×' + s.n + "</span>" : "") + '<span class="kit-step__tick" aria-hidden="true">✓</span>');
      card.appendChild(c);
      return c;
    });
    // the bowl / pan / board, and who is waiting to eat
    const bench = el("div", "kit-bench");
    const pot = el("div", "kit-pot kit-pot--" + r.vessel, '<span class="kit-pot__in" aria-hidden="true"></span><span class="kit-pot__stack" aria-hidden="true"></span>');
    pot.setAttribute("role", "img");
    pot.setAttribute("aria-label", "The " + r.vessel);
    // A friend is drawn the way the rest of the app draws them (JoshArt.friend
    // from content.js FRIENDS), so River looks like River here too.
    const eater = el("div", "kit-eater", '<span class="kit-eater__face" aria-hidden="true">' + faceOf(r) + '</span><span class="kit-eater__yum" aria-hidden="true">😋</span><span class="kit-eater__plate" aria-hidden="true">🍽️</span>');
    eater.setAttribute("role", "img");
    eater.setAttribute("aria-label", r.eater + " is waiting");
    bench.append(pot, eater);
    // the counter: one big button per tool
    const counter = el("div", "kit-counter kit-counter--" + r.tools.length);
    const btn = {};
    for (const id of r.tools) {
      const b = el("button", "kit-tool tap", '<span aria-hidden="true">' + TOOLS[id].pic + "</span>");
      b.type = "button";
      b.setAttribute("aria-label", TOOLS[id].label);
      b.dataset.tool = id;
      btn[id] = b;
      counter.appendChild(b);
    }
    scene.append(card, bench, counter);
    api.stage.appendChild(scene);

    const inEl = pot.querySelector(".kit-pot__in"), stackEl = pot.querySelector(".kit-pot__stack");
    let k = 0, done = 0, total = 0, busy = false;
    const step = () => steps[k];
    const ask = () => {
      const s = step();
      cells.forEach((c, i) => c.classList.toggle("kit-step--now", i === k));
      api.next(btn[s.t]);
    };
    const intro = r.zh ? "Let's make Grandma's dumplings! Look at the card." : "Let's make " + r.name.toLowerCase() + " for " + r.eater + "! Look at the card.";
    api.prompt("📋 ➡️ " + r.dish, intro + " First, " + todo(TOOLS[steps[0].t], steps[0].n) + ".");
    ask();

    function advance() {
      done = 0;
      cells[k].classList.add("kit-step--done");
      k += 1;
      if (k < steps.length) {
        const s = step();
        api.say("Now " + todo(TOOLS[s.t], s.n) + ".");
        ask();
        return;
      }
      serve();
    }
    function serve() {
      cells.forEach((c) => c.classList.remove("kit-step--now"));
      busy = true;
      api.next([]);
      api.later(() => {
        pot.classList.add("kit-pot--served");
        eater.classList.add("kit-eater--happy");
        eater.querySelector(".kit-eater__plate").textContent = r.dish;
        eater.setAttribute("aria-label", r.eater + " is eating");
        if (r.zh) { api.sayZh("好吃！"); api.later(() => api.done("Grandma says hao chi! That means yummy!"), 900); }
        else api.done(r.eater + " says yum! You made " + r.name.toLowerCase() + "!");
      }, api.reduce() ? 0 : 500);
    }
    // what one tap of a tool does to the dish
    function act(id) {
      const s = step(), tool = TOOLS[id];
      done += 1;
      total += 1;
      const n = done;
      if (tool.add) inEl.textContent += tool.add;
      else if (tool.act === "stir") { pot.classList.add("kit-pot--mixed"); inEl.textContent = ""; if (!steps.some((x) => x.t === "pan")) stackEl.textContent = r.dish; }
      else if (tool.act === "cook") { pot.classList.add("kit-pot--pan"); inEl.textContent = ""; stackEl.textContent += r.dish; }
      else if (tool.act === "skins") { inEl.textContent = "⚪".repeat(steps.find((x) => x.t === "fill").n); }
      else if (tool.act === "fill") { inEl.textContent = "🥟".repeat(n) + "⚪".repeat(Math.max(0, s.n - n)); }
      else if (tool.act === "boil") { pot.classList.add("kit-pot--steam"); stackEl.textContent = "💨"; }
      else if (tool.act === "sauce") { pot.classList.add("kit-pot--sauce"); }
      else if (tool.act === "bake") pot.classList.add("kit-pot--baked"); // the toppings stay: it is HIS pizza
      api.tone(NOTES[Math.min(NOTES.length - 1, n - 1)], { duration: 0.2 });
      api.good(pot);
      if (r.zh && tool.act === "fill") api.sayZh(ZH[n]);
      else if (s.n > 1) api.say(cap(COUNT[n]) + "!");
      else if (tool.act === "stir") api.say("Stir, stir, stir!");
      else if (tool.act === "boil") api.say("Into the pot! Bubble, bubble!");
      else if (tool.act === "bake") api.say("Into the oven! Hot, hot!");
      else api.say(tool.label + "!");
      if (n >= s.n) {
        if (r.zh && tool.act === "fill") api.say(cap(COUNT[n]) + " dumplings!");
        busy = true;
        api.next([]);
        api.later(() => { busy = false; advance(); }, api.reduce() ? 0 : 450);
      }
    }
    for (const id of r.tools) {
      btn[id].addEventListener("click", () => {
        if (busy || k >= steps.length) return;
        const s = step();
        if (id !== s.t) {
          const need = TOOLS[s.t];
          api.bump(btn[id], done ? "One more " + need.one + "! Look at the card." : "Look at the card! Now " + todo(need, s.n) + ".");
          return;
        }
        act(id);
      });
    }
  }

  T.register({
    id: "kitchen",
    name: "Little Kitchen",
    icon: "🍳",
    color: "#ffd6c2",
    say: "Welcome to the Little Kitchen! What shall we cook?",
    levels: RECIPES.map((r) => ({ id: r.id, name: r.name, icon: r.icon, doneIcon: r.doneIcon, recipe: r })),
    play(api, level) { play(api, level.recipe); },
    recipes: RECIPES,
    tools: TOOLS,
  });
})(typeof window !== "undefined" ? window : globalThis);
