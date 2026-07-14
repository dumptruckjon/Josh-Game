// Sticker Book — the reward meta-layer for Josh's Games. Two small modules:
//
//   window.JoshProgress — the ONE owner of the josh-won-* "beaten this game"
//     flags. The framework records a win here, and the launcher's ⭐ badges,
//     the Sticker Book, and the grown-ups reset all read/write through it, so
//     the state can never drift between callers (RULE 7 centralization).
//
//   window.JoshStickers — JoshStickers.artFor(def): a DETERMINISTIC, valid
//     <svg> sticker for a game (same game → same sticker, always), drawn from
//     the existing JoshArt library (hero/pup/numberFriend/friend/…). Beating a
//     game "plops" its signature sticker into the scrapbook.
//
// Runs in the browser (window.*) — no Node exports needed (syntax-checked only).

(function (global) {
  // ---- JoshProgress: the single source of truth for "games Josh has won" ----
  const PREFIX = "josh-won-";
  const keyFor = (id) => PREFIX + id;

  function isWon(id) {
    try { return localStorage.getItem(keyFor(id)) === "1"; } catch (e) { return false; }
  }
  function markWon(id) {
    if (!id) return;
    try { localStorage.setItem(keyFor(id), "1"); } catch (e) { /* storage may be unavailable */ }
    // The launcher listens for this to badge the tile + fill the sticker slot.
    try { global.dispatchEvent(new CustomEvent("josh-won", { detail: { id: id } })); } catch (e) { /* ignore */ }
  }
  function wonIds() {
    const out = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.indexOf(PREFIX) === 0) out.push(k.slice(PREFIX.length));
      }
    } catch (e) { /* ignore */ }
    return out;
  }
  function wonCount() { return wonIds().length; }
  function clear() {
    let n = 0;
    try {
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.indexOf(PREFIX) === 0) keys.push(k);
      }
      keys.forEach((k) => { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } });
      n = keys.length;
    } catch (e) { /* ignore */ }
    return n;
  }

  global.JoshProgress = { isWon, markWon, wonIds, wonCount, clear, PREFIX };

  // ---- JoshStickers: a deterministic sticker per game, reusing JoshArt ----
  // A stable hash of the game id picks the art kind + colour, so a given game
  // always shows the same sticker (a test asserts determinism + valid <svg>),
  // while the collection as a whole is colourful and varied — and it finally
  // uses the whole art library, including the otherwise-idle truck/rocket.
  const PALETTE = [
    "#e23636", "#2b6cff", "#3fa96b", "#ffa64d", "#c77dff", "#2bb3c0",
    "#ff5e7e", "#ffd24d", "#5ec8ff", "#ec4e9c", "#7be08a", "#6a4bd6",
  ];
  const KINDS = ["hero", "numberFriend", "pup", "balloon", "friend", "rocket", "truck", "star"];
  const HAIR = ["fringe", "wavy", "bowl", "curly", "short"];

  function hashStr(s) {
    s = String(s || "");
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = (h * 16777619) >>> 0; }
    return h >>> 0;
  }

  function artFor(def) {
    const ART = global.JoshArt;
    const id = (def && def.id) || String(def || "");
    const h = hashStr(id);
    const color = PALETTE[h % PALETTE.length];
    if (!ART) return "";
    const kind = KINDS[Math.floor(h / 7) % KINDS.length];
    switch (kind) {
      case "hero": return ART.hero(color);
      case "numberFriend": return ART.numberFriend((h % 9) + 1, color);
      case "pup": return ART.pup(color);
      case "balloon": return ART.balloon(color);
      case "friend": return ART.friend({ skin: "#f1c9a5", hair: "#2a1a12", style: HAIR[Math.floor(h / 13) % HAIR.length], shirt: color });
      case "rocket": return ART.rocket();
      case "truck": return ART.truck(color);
      default: return ART.star(color);
    }
  }

  global.JoshStickers = { artFor };
})(typeof window !== "undefined" ? window : globalThis);
