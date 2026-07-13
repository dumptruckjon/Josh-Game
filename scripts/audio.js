// Shared audio for Josh's Games. Voice is the PRIMARY instruction channel for a
// non-reader — but sound is OFF by default (iOS blocks autoplay; a quiet default
// is kinder) and every game is fully playable with sound off (icons + demo).
// Exposes window.JoshAudio.

(function (global) {
  const KEY = "josh-muted";
  let muted = true;
  try { muted = localStorage.getItem(KEY) !== "0"; } catch (e) { muted = true; }

  function isMuted() { return muted; }
  function setMuted(m) {
    muted = !!m;
    try { localStorage.setItem(KEY, muted ? "1" : "0"); } catch (e) { /* ignore */ }
  }
  function toggle() {
    setMuted(!muted);
    if (!muted) say("Yay!"); // doubles as the iOS "unlock audio" gesture
    return muted;
  }
  // Speak a short phrase. Guarded so a missing/blocked speech API is harmless.
  function say(text) {
    if (muted || !text) return;
    try {
      if (global.speechSynthesis && global.SpeechSynthesisUtterance) {
        const u = new global.SpeechSynthesisUtterance(String(text));
        u.rate = 0.95;
        u.pitch = 1.15;
        global.speechSynthesis.cancel();
        global.speechSynthesis.speak(u);
      }
    } catch (e) { /* ignore */ }
  }

  global.JoshAudio = { isMuted, setMuted, toggle, say, KEY };
})(typeof window !== "undefined" ? window : globalThis);
