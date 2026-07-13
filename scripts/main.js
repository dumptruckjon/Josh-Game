// Josh's Games — vanilla JS, no dependencies, no build step.
// All content (animals, cheers, colors) comes from scripts/content.js.
//
// Kid-first rules baked in here: no fail states, no timers, huge tap targets,
// celebrate every tap, and sound is OFF by default (a grown-up turns it on).

(function () {
  const C = (typeof window !== "undefined" && window.JoshContent) || {};

  const randItem = (arr) => arr[Math.floor(Math.random() * arr.length)];

  // Pick a random index in [0, len), avoiding `current` so the same thing never
  // shows twice in a row.
  function pickIndex(len, current) {
    if (len <= 1) return 0;
    let next = current;
    while (next === current) next = Math.floor(Math.random() * len);
    return next;
  }

  // Sound is OFF by default (iOS blocks autoplay anyway, and a quiet toy is the
  // kinder default). A grown-up flips it with the big speaker button; the choice
  // is remembered. "0" means explicitly ON.
  let muted = true;
  function loadMuted() {
    try { return localStorage.getItem("josh-muted") !== "0"; } catch (e) { return true; }
  }
  // Speak a short word (an animal's name) — only when sound is on and the API
  // exists. Guarded so a missing/*blocked* speech API can never break a toy.
  function say(text) {
    if (muted || !text) return;
    try {
      if (window.speechSynthesis && window.SpeechSynthesisUtterance) {
        const u = new SpeechSynthesisUtterance(text);
        u.rate = 0.9;
        u.pitch = 1.2;
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(u);
      }
    } catch (e) { /* ignore */ }
  }

  document.addEventListener("DOMContentLoaded", () => {
    // Isolate each feature: if one throws, the others still work.
    const features = [
      initSound,
      initAnimalToy,
    ];
    for (const init of features) {
      try { init(); } catch (e) { console.error("Josh: a feature failed to start:", e); }
    }
  });

  // Register the service worker (PWA / offline). Best-effort; never blocks the UI.
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch((e) =>
        console.warn("Josh: service worker registration failed:", e)
      );
    });
  }

  // ---------- Big sound on/off toggle ----------
  function initSound() {
    const btn = document.getElementById("sound-toggle");
    muted = loadMuted();
    updateBtn();
    if (!btn) return;
    btn.addEventListener("click", () => {
      muted = !muted;
      try { localStorage.setItem("josh-muted", muted ? "1" : "0"); } catch (e) { /* ignore */ }
      updateBtn();
      // Speaking right after unmute doubles as the iOS "unlock audio" gesture.
      if (!muted) say("Yay");
    });
    function updateBtn() {
      if (!btn) return;
      btn.textContent = muted ? "🔇" : "🔊";
      btn.setAttribute(
        "aria-label",
        muted ? "Sound is off. Tap to turn sound on." : "Sound is on. Tap to turn sound off."
      );
      btn.setAttribute("aria-pressed", String(!muted));
    }
  }

  // ---------- "Say hi to the animals" toy ----------
  // Tap the giant card: it celebrates (confetti), counts a new friend, and a
  // brand-new animal pops in. There is no wrong move and no timer — pure
  // cause -> effect for little hands.
  function initAnimalToy() {
    const card = document.getElementById("animal-card");
    const emojiEl = document.getElementById("animal-emoji");
    const nameEl = document.getElementById("animal-name");
    const cheerEl = document.getElementById("animal-cheer");
    const countEl = document.getElementById("friend-count");
    if (!card || !emojiEl || !nameEl || !C.ANIMALS || !C.ANIMALS.length) return;

    const KEY = "josh-friends";
    let count = 0;
    try { count = Number(localStorage.getItem(KEY)) || 0; } catch (e) { count = 0; }
    if (countEl) countEl.textContent = String(count);

    // Start on a random friend so it feels fresh every visit.
    let idx = Math.floor(Math.random() * C.ANIMALS.length);
    function show(i) {
      const a = C.ANIMALS[i];
      emojiEl.textContent = a.emoji;
      nameEl.textContent = a.name;
      card.setAttribute("aria-label", a.name);
    }
    show(idx);

    function meet() {
      // Count a new friend (saved so progress survives a reload / offline).
      count += 1;
      if (countEl) countEl.textContent = String(count);
      try { localStorage.setItem(KEY, String(count)); } catch (e) { /* ignore */ }

      // Celebrate — always. Confetti is free.
      if (window.JoshEffects) window.JoshEffects.confetti({ colors: C.CONFETTI_COLORS });
      if (cheerEl) cheerEl.textContent = randItem(C.CHEERS);

      // Reveal a brand-new animal and (optionally) say its name.
      idx = pickIndex(C.ANIMALS.length, idx);
      show(idx);
      say(C.ANIMALS[idx].name);

      // Replay the little pop animation.
      card.classList.remove("pop");
      void card.offsetWidth; // force reflow so the animation restarts
      card.classList.add("pop");
    }

    // Pointer/click covers mouse + touch; keyboard for completeness/accessibility.
    card.addEventListener("click", meet);
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); meet(); }
    });
  }
})();
