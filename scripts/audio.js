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

  // ---- WebAudio instrument tones (the ONE correct, iOS-safe implementation) ----
  // Every game that makes musical/effect sound MUST call JoshAudio.tone() rather
  // than construct its own AudioContext (a guardrail test enforces this). This is
  // where the hard-won iOS fix lives so it can never regress per-game: on iOS the
  // context starts SUSPENDED and resume() is async, so we resume FIRST and only
  // schedule the note in the resolved callback, a hair in the future so it's never
  // played in the past (which is silent on iPhone/iPad). A deliberate instrument
  // is gesture-triggered and plays independently of the voice mute (that only
  // silences spoken prompts).
  let actx = null;
  function audioCtx() {
    const AC = global.AudioContext || global.webkitAudioContext;
    if (!AC) return null;
    if (!actx) { try { actx = new AC(); } catch (e) { return null; } }
    return actx;
  }
  function playFreq(c, freq, opts) {
    opts = opts || {};
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = opts.type || "triangle";
    o.frequency.value = freq;
    const dur = opts.duration || 0.6;
    const peak = opts.gain || 0.3;
    const t = c.currentTime + 0.02; // small look-ahead: never schedule in the past
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.02); // soft attack
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g); g.connect(c.destination);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
  function tone(freq, opts) {
    try {
      const c = audioCtx();
      if (!c) return;
      if (c.state === "suspended" && c.resume) c.resume().then(() => playFreq(c, freq, opts)).catch(() => {});
      else playFreq(c, freq, opts);
    } catch (e) { /* ignore */ }
  }
  // Warm the audio context on the first user gesture so the first note isn't the
  // one that "spends" the resume. Best-effort, safe to call repeatedly.
  function unlock() {
    try { const c = audioCtx(); if (c && c.state === "suspended" && c.resume) c.resume().catch(() => {}); } catch (e) { /* ignore */ }
  }

  global.JoshAudio = { isMuted, setMuted, toggle, say, tone, unlock, KEY };
})(typeof window !== "undefined" ? window : globalThis);
