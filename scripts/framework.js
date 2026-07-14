// The shared game framework for Josh's Games. Every game registers a small
// definition and gets, for free: a consistent screen (Home button, spoken
// prompt + "hear it again" 👂, an icon instruction strip, a big Again button),
// celebration + gentle try-again, friend/hero rotation, and — importantly — a
// uniform TEST CONTRACT so headless Playwright can play every game the same way:
//
//   • The element(s) that are a correct next tap carry  data-correct="1".
//     A game keeps that attribute on whatever is correct RIGHT NOW and removes
//     it once consumed, so "tap the first [data-correct]" is always valid.
//   • When a game is finished it sets  screen.dataset.won = "1"  (api.win()).
//   • Pure toys (no win state) mark their main control [data-toy] and bump
//     screen.dataset.plays on each interaction (api.tickPlay()).
//
// Exposes window.JoshFramework and populates window.JoshGames (the registry).

(function (global) {
  const C = global.JoshContent || {};
  const L = global.JoshLogic || {};
  const FX = global.JoshEffects || { confetti() {}, stars() {} };
  const A = global.JoshAudio || { say() {}, isMuted: () => true };

  global.JoshGames = global.JoshGames || [];
  function register(def) { global.JoshGames.push(def); }

  const randItem = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const shuffle = (arr) => (L.shuffle ? L.shuffle(arr) : arr.slice());
  const randInt = (a, b) => (L.randInt ? L.randInt(a, b) : a + Math.floor(Math.random() * (b - a + 1)));
  const pickIndex = (n, cur) => (L.pickIndex ? L.pickIndex(n, cur) : Math.floor(Math.random() * n));

  // Rotating friend so each game/round feels personal, never repetitive.
  let friendCursor = Math.floor(Math.random() * ((C.FRIENDS || [{}]).length || 1));
  function nextFriend() {
    const friends = C.FRIENDS || [{ name: "Josh", emoji: "🧒" }];
    friendCursor = (friendCursor + 1) % friends.length;
    return friends[friendCursor];
  }

  // Tiny DOM helper: el("button", {class:"x", onclick, dataset:{k:v}}, [kids]).
  function el(tag, props, kids) {
    const node = document.createElement(tag);
    if (props) {
      for (const [k, v] of Object.entries(props)) {
        if (v == null) continue;
        if (k === "class") node.className = v;
        else if (k === "text") node.textContent = v;
        else if (k === "html") node.innerHTML = v;
        else if (k === "dataset") for (const [dk, dv] of Object.entries(v)) node.dataset[dk] = dv;
        else if (k === "style" && typeof v === "object") Object.assign(node.style, v);
        else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
        else if (k === "aria") for (const [ak, av] of Object.entries(v)) node.setAttribute("aria-" + ak, av);
        else node.setAttribute(k, v);
      }
    }
    for (const kid of [].concat(kids || [])) {
      if (kid == null) continue;
      node.appendChild(typeof kid === "string" ? document.createTextNode(kid) : kid);
    }
    return node;
  }

  // Build a game's screen and wire the shared chrome + api. Returns the screen
  // element with helpers attached (__start to (re)render, __onShow for the
  // router to auto-speak the prompt when the screen becomes visible).
  function buildGameScreen(def) {
    const screen = el("section", {
      class: "screen game", id: "screen-" + def.id, dataset: { id: def.id }, hidden: "",
    });

    const homeBtn = el("button", {
      class: "btn-round game__home", type: "button", text: "🏠",
      aria: { label: "Back" },
      // Return to this game's category screen (set by the launcher) if known.
      onclick: () => { location.hash = def.cat ? "#cat-" + def.cat : ""; },
    });
    const hearBtn = el("button", {
      class: "btn-round game__hear", type: "button", text: "👂",
      aria: { label: "Hear it again" }, onclick: () => speak(),
    });
    const titleEl = el("h2", { class: "game__title", text: def.title });
    const bar = el("div", { class: "game__bar" }, [homeBtn, titleEl, hearBtn]);

    const iconsEl = el("span", { class: "game__icons", aria: { hidden: "true" } });
    const promptText = el("span", { class: "game__promptText" });
    const prompt = el("div", { class: "game__prompt" }, [iconsEl, promptText]);

    const stage = el("div", { class: "game__stage", dataset: { stage: "1" } });

    const againBtn = el("button", {
      class: "btn-big game__again", type: "button", hidden: "",
      onclick: () => start(),
    }, ["Again 🔁"]);
    const foot = el("div", { class: "game__foot" }, [againBtn]);

    screen.append(bar, prompt, stage, foot);

    let currentPrompt = "";
    function speak() { A.say(currentPrompt); }

    // A#2: an optional reactive buddy. A game opts in with api.mascot() (idempotent
    // — reuses the same character across rounds) and the shared win/roundWin/
    // tryAgain hooks make it cheer or wiggle, so ~flat quiz games gain a friend
    // that reacts to the child's taps. Non-mascot games are unaffected.
    let mascotEl = null;
    function reactMascot(kind) {
      if (!mascotEl) return;
      mascotEl.classList.remove("mascot--cheer", "mascot--wiggle");
      void mascotEl.offsetWidth; // restart the animation
      mascotEl.classList.add(kind === "wiggle" ? "mascot--wiggle" : "mascot--cheer");
    }

    const api = {
      C, stage, el, shuffle, randItem, randInt, pickIndex,
      friend: nextFriend, hero: () => randItem(C.HEROES || [{ emoji: "⭐", name: "Star" }]),
      clear() { stage.innerHTML = ""; },
      // Set the spoken prompt + the big icon instruction strip (pictures carry it).
      setPrompt(text, icons) {
        currentPrompt = text || "";
        promptText.textContent = text || "";
        iconsEl.textContent = (icons || []).join(" ");
      },
      say: (t) => A.say(t),
      speak,
      // Opt-in reactive buddy. Call each round (after building the round's UI) so
      // the friend sits at the bottom, "on the floor"; it persists across rounds.
      mascot(opts) {
        opts = opts || {};
        if (!mascotEl) {
          const ART = global.JoshArt;
          const svg = (ART && ART.numberFriend) ? ART.numberFriend(1, opts.color || "#5aa9e6") : "🙂";
          mascotEl = el("div", { class: "game__mascot art-fill", html: svg, aria: { hidden: "true" } });
        }
        stage.appendChild(mascotEl); // (re)attach after a stage rebuild
        return mascotEl;
      },
      // A correct round in a multi-round game (celebrate, keep going).
      roundWin(opts) {
        FX.confetti({ colors: C.CONFETTI_COLORS, count: 70 });
        try { if (A.goodCue) A.goodCue(); } catch (e) { /* ignore */ }
        reactMascot("cheer");
        if (opts && opts.say) A.say(opts.say);
      },
      // The whole game is finished — celebrate, mark won, offer Again.
      win(opts) {
        screen.dataset.won = "1";
        screen.classList.add("is-won");
        FX.confetti({ colors: C.CONFETTI_COLORS });
        try { if (A.winCue) A.winCue(); } catch (e) { /* ignore */ } // the "you did it!" jingle
        reactMascot("cheer");
        if (FX.stars) FX.stars();
        A.say((opts && opts.say) || randItem(C.PRAISE_SPOKEN || ["Yay"]));
        againBtn.hidden = false;
        // A friendly homage hero pops in to celebrate (original SVG art).
        try {
          const ART = global.JoshArt;
          if (ART && ART.hero) {
            const colors = ["#e23636", "#ec4e9c", "#2b6cff"];
            const cheer = el("div", { class: "win-hero", html: ART.hero(colors[Math.floor(Math.random() * colors.length)]), aria: { hidden: "true" } });
            screen.appendChild(cheer);
            setTimeout(() => cheer.remove(), 1700);
          }
        } catch (e) { /* ignore */ }
        // Record the win in ONE place (JoshProgress) so the ⭐ badge, the Sticker
        // Book, and the launcher all read the same source of truth. Fallback keeps
        // it working if the progress module ever fails to load.
        if (global.JoshProgress) { global.JoshProgress.markWon(def.id); }
        else {
          try { localStorage.setItem("josh-won-" + def.id, "1"); } catch (e) { /* ignore */ }
          try { window.dispatchEvent(new CustomEvent("josh-won", { detail: { id: def.id } })); } catch (e) { /* ignore */ }
        }
      },
      // Gentle "try again": a soft bump, a kind word, nothing punishing.
      tryAgain(node) {
        if (node) {
          node.classList.remove("bump");
          void node.offsetWidth;
          node.classList.add("bump");
        }
        try { if (A.bumpCue) A.bumpCue(); } catch (e) { /* ignore */ } // soft, non-punishing
        reactMascot("wiggle");
        A.say(randItem(C.TRYAGAIN_SPOKEN || ["Try again"]));
      },
      // For pure toys with no win state.
      tickPlay() {
        screen.dataset.plays = String((Number(screen.dataset.plays) || 0) + 1);
      },
    };

    function start() {
      screen.classList.remove("is-won");
      delete screen.dataset.won;
      againBtn.hidden = true;
      stage.innerHTML = "";
      try { def.start(api); } catch (e) { console.error("Josh: game '" + def.id + "' failed:", e); }
    }

    screen.__start = start;
    screen.__started = false;
    screen.__onShow = () => { speak(); };
    return screen;
  }

  global.JoshFramework = { register, buildGameScreen, el, shuffle, randItem, randInt, pickIndex };
})(typeof window !== "undefined" ? window : globalThis);
