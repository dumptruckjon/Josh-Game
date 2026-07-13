// Josh's Games — launcher + router + boot. Builds the home grid from the game
// registry (window.JoshGames), mounts each game's screen, and switches screens
// via the URL hash (so the phone Back button works and games are deep-linkable
// and testable). Feature-isolated: one broken game can't take down the rest.

(function () {
  const C = window.JoshContent || {};
  const A = window.JoshAudio || { isMuted: () => true, toggle() {} };
  const F = window.JoshFramework;

  document.addEventListener("DOMContentLoaded", () => {
    for (const init of [initSound, initLauncher]) {
      try { init(); } catch (e) { console.error("Josh: init failed:", e); }
    }
  });

  // Register the service worker (PWA / offline). Best-effort; never blocks UI.
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch((e) =>
        console.warn("Josh: service worker registration failed:", e)
      );
    });
  }

  // ---- Big sound on/off toggle (off by default) ----
  function initSound() {
    const btn = document.getElementById("sound-toggle");
    if (!btn) return;
    function upd() {
      const m = A.isMuted();
      btn.textContent = m ? "🔇" : "🔊";
      btn.setAttribute("aria-label", m ? "Sound is off. Tap to turn sound on." : "Sound is on. Tap to turn sound off.");
      btn.setAttribute("aria-pressed", String(!m));
    }
    upd();
    btn.addEventListener("click", () => { A.toggle(); upd(); });
  }

  // ---- Launcher: build tiles + screens, then route by hash ----
  function initLauncher() {
    const screens = document.getElementById("screens");
    const grid = document.getElementById("home-grid");
    if (!screens || !grid || !F) return;

    const games = window.JoshGames || [];
    games.forEach((def) => {
      const tile = document.createElement("button");
      tile.className = "tile tap";
      tile.type = "button";
      tile.dataset.go = def.id;
      tile.setAttribute("role", "listitem");
      tile.setAttribute("aria-label", def.title);
      const icon = document.createElement("span");
      icon.className = "tile__icon";
      icon.setAttribute("aria-hidden", "true");
      icon.textContent = def.icon;
      const label = document.createElement("span");
      label.className = "tile__label";
      label.textContent = def.title;
      tile.append(icon, label);
      tile.addEventListener("click", () => { location.hash = "#" + def.id; });
      grid.appendChild(tile);

      const screen = F.buildGameScreen(def);
      screens.appendChild(screen);
    });

    window.addEventListener("hashchange", route);
    route();
  }

  function route() {
    const id = (location.hash || "").replace(/^#/, "");
    const home = document.getElementById("screen-home");
    document.querySelectorAll(".screen").forEach((s) => { s.hidden = true; });

    if (!id || id === "home") {
      if (home) home.hidden = false;
      document.body.classList.remove("in-game");
      window.scrollTo(0, 0);
      return;
    }
    const target = document.getElementById("screen-" + id);
    if (target) {
      target.hidden = false;
      document.body.classList.add("in-game");
      if (!target.__started) { target.__start(); target.__started = true; }
      if (target.__onShow) target.__onShow();
      window.scrollTo(0, 0);
    } else if (home) {
      home.hidden = false;
      document.body.classList.remove("in-game");
    }
  }
})();
