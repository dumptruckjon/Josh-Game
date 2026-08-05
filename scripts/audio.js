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
  // THE MASTER BUS. Every voice in all three worlds goes through it, and it
  // exists because the old code connected each oscillator straight to
  // `destination`: with no headroom and no limiter, simultaneous cues simply
  // SUM. That is not hypothetical — a mortar splash kills a whole group at
  // once, so `die` (one tone per kill, unthrottled) can fire ten voices in a
  // tick on top of `splash` and `shoot`, and on a phone speaker that clips into
  // a crackle. A compressor with a low threshold is a soft limiter: quiet
  // things are untouched, a pile-up is squashed instead of distorting.
  //   `createDynamicsCompressor` is ancient (Safari 6), but it is feature
  // checked anyway and degrades to a plain gain — the canvas-floor lesson
  // applied to audio: never assume, and never let a missing node mute the game.
  let bus = null;
  function master(c) {
    if (bus) return bus;
    try {
      const g = c.createGain();
      g.gain.value = 0.9;
      if (c.createDynamicsCompressor) {
        const k = c.createDynamicsCompressor();
        // A limiter, not a pumping compressor: high ratio, fast attack so a
        // burst is caught, slow-ish release so it does not breathe.
        if (k.threshold) k.threshold.value = -14;
        if (k.knee) k.knee.value = 6;
        if (k.ratio) k.ratio.value = 12;
        if (k.attack) k.attack.value = 0.003;
        if (k.release) k.release.value = 0.18;
        g.connect(k); k.connect(c.destination);
      } else {
        g.connect(c.destination);
      }
      bus = g;
    } catch (e) { bus = null; }
    return bus;
  }

  // A VOICE CAP. `die` fires once per kill with no throttle, so a wave that
  // ends in a splash can ask for dozens of oscillators inside one frame. Past a
  // handful they stop being distinguishable and become noise, so extra voices
  // are DROPPED rather than queued — a late note is worse than no note.
  const MAX_VOICES = 12;
  let voices = 0;

  function playFreq(c, freq, opts) {
    opts = opts || {};
    const out = master(c) || c.destination;
    if (voices >= MAX_VOICES) return;
    const dur = opts.duration || 0.6;
    const peak = opts.gain || 0.3;
    const t = c.currentTime + 0.02; // small look-ahead: never schedule in the past
    const g = c.createGain();

    // A TONE WITH A BODY, not a bare waveform. Every sound in the app used to
    // be one raw oscillator into the speaker, which is why it read as a beeper
    // rather than a toybox: no harmonic, no filter, nothing to give it size.
    // Two cheap additions fix that and both are bounded by the voice cap — a
    // second oscillator a fifth up at low level (a partial, so notes have
    // sparkle) and a gentle lowpass that takes the fizz off `square`.
    // `opts.plain` opts a cue out when it wants the dry click.
    const rich = !opts.plain;
    if (rich && c.createBiquadFilter) {
      const f = c.createBiquadFilter();
      f.type = "lowpass";
      // track the note so a high tick stays bright and a low thump stays round
      f.frequency.value = Math.max(700, Math.min(12000, freq * 4.5));
      f.Q.value = 0.7;
      g.connect(f); f.connect(out);
    } else {
      g.connect(out);
    }

    const o = c.createOscillator();
    o.type = opts.type || "triangle";
    o.frequency.value = freq;
    o.connect(g);

    let o2 = null;
    if (rich && dur >= 0.05) {
      o2 = c.createOscillator();
      o2.type = "sine";
      o2.frequency.value = freq * 2.005;   // an octave, barely detuned so it shimmers
      const g2 = c.createGain();
      g2.gain.value = 0.16;
      o2.connect(g2); g2.connect(g);
    }

    // A REAL ENVELOPE. The old one used a fixed 20ms attack for every cue, so a
    // 30ms "tick" spent two thirds of its life attacking and had no snap at
    // all; and it ramped to 0.0008 and then stopped the oscillator outright,
    // which clicks. Attack now scales with the note, and the tail ramps
    // linearly to true silence before the oscillator is stopped.
    const atk = Math.max(0.004, Math.min(0.02, dur * 0.25));
    const end = t + dur;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + atk);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0008, peak * 0.02), end);
    g.gain.linearRampToValueAtTime(0, end + 0.03);   // click-free tail

    // The cap is only safe if a voice is ALWAYS released — a counter that can
    // leak would make the game go permanently silent, which is far worse than
    // the pile-up it prevents. So `done` is idempotent and fired by whichever
    // of the two paths arrives first: `onended`, or a timer for the case where
    // a backgrounded tab never delivers it.
    voices++;
    let freed = false;
    const done = () => { if (freed) return; freed = true; voices = Math.max(0, voices - 1); };
    o.onended = done;
    setTimeout(done, (dur + 0.5) * 1000);
    o.start(t); o.stop(end + 0.04);
    if (o2) { o2.start(t); o2.stop(end + 0.04); }
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
