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
  // opts.lang switches the voice language (e.g. "zh-CN" for 华丽's games —
  // Mandarin at a calmer rate/pitch); omitted = the device default (English).
  function say(text, opts) {
    if (muted || !text) return;
    try {
      if (global.speechSynthesis && global.SpeechSynthesisUtterance) {
        const u = new global.SpeechSynthesisUtterance(String(text));
        const zh = !!(opts && opts.lang && String(opts.lang).indexOf("zh") === 0);
        if (opts && opts.lang) u.lang = opts.lang;
        u.rate = zh ? 0.85 : 0.95;
        u.pitch = zh ? 1.0 : 1.15;
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

  // ---- Celebration cues: the game's SOUND feedback (win / correct / oops) ----
  // Wired once into the framework so every game inherits them. Unlike a music
  // instrument, these are gentle feedback the parent can silence: they respect
  // the mute (sound is OFF by default), and route through the iOS-safe tone().
  function cue(seq) {
    if (muted) return; // celebration sound respects the mute (sound is OFF by default)
    unlock();          // warm the context on this gesture so the first note isn't lost
    for (const n of seq) {
      if (!n.delay) tone(n.freq, n.opts);
      else setTimeout(() => tone(n.freq, n.opts), n.delay);
    }
  }
  // A rising 3-note "you did it!" jingle (C5–E5–G5).
  function winCue() { cue([{ freq: 523.25 }, { freq: 659.25, delay: 120 }, { freq: 783.99, delay: 240, opts: { duration: 0.7 } }]); }
  // A single bright confirming note for a correct round.
  function goodCue() { cue([{ freq: 659.25, opts: { duration: 0.32, gain: 0.22 } }]); }
  // A soft, low, NON-punishing "hmm, try another" note (never a harsh buzzer).
  function bumpCue() { cue([{ freq: 246.94, opts: { type: "sine", duration: 0.22, gain: 0.16 } }]); }

  global.JoshAudio = { isMuted, setMuted, toggle, say, tone, unlock, winCue, goodCue, bumpCue, KEY };
})(typeof window !== "undefined" ? window : globalThis);
