// Shared celebration effects for Josh's Games. Exposes
// window.JoshEffects.confetti() and .stars(). Self-contained, no dependencies.
// Respects prefers-reduced-motion (becomes a no-op) in ONE place, so every game
// rewards a win consistently and calmly.

(function (global) {
  function reduceMotion() {
    return global.matchMedia && global.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  // ONE canvas + ONE rAF loop + ONE shared pieces pool, no matter how many
  // bursts fire (audit: a hammer-tapping toddler piled up 66 concurrent
  // full-screen canvases and dropped the frame rate 59→14fps). Every burst
  // feeds the shared pool (capped — oldest pieces drop first); the loop tears
  // the canvas down when the pool empties. Visually identical for single wins.
  const MAX_PIECES = 400;
  let canvas = null, ctx = null, pieces = [], running = false;

  function ensureCanvas() {
    if (canvas) return true;
    canvas = document.createElement("canvas");
    // longhands, not the inset: shorthand — dropped on iOS 14.2 (audit)
    canvas.style.cssText = "position:fixed;top:0;right:0;bottom:0;left:0;width:100%;height:100%;pointer-events:none;z-index:60";
    canvas.setAttribute("aria-hidden", "true");
    document.body.appendChild(canvas);
    ctx = canvas.getContext("2d");
    if (!ctx) { canvas.remove(); canvas = null; return false; }
    canvas.width = global.innerWidth;
    canvas.height = global.innerHeight;
    return true;
  }

  function loop() {
    if (!canvas) { running = false; return; }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const gone = [];
    for (const p of pieces) {
      p.vy += p.gravity;
      p.vx *= 0.99;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      p.life -= 0.006;
      if (p.life > 0 && p.y < canvas.height + 30) {
        ctx.save();
        ctx.globalAlpha = Math.max(p.life, 0);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        if (p.char) {
          ctx.font = p.size * 2.4 + "px serif";
          ctx.textAlign = "center";
          ctx.fillText(p.char, 0, 0);
        } else {
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        }
        ctx.restore();
      } else {
        gone.push(p);
      }
    }
    if (gone.length) pieces = pieces.filter((p) => !gone.includes(p));
    if (pieces.length) {
      requestAnimationFrame(loop);
    } else {
      canvas.remove(); canvas = null; ctx = null; running = false;
    }
  }

  function burst(opts) {
    opts = opts || {};
    if (reduceMotion()) return;
    if (!global.document || !global.requestAnimationFrame) return;
    if (!ensureCanvas()) return;
    const emoji = opts.emoji || null; // if set, draw emoji instead of rects
    const colors = opts.colors || ["#ff5e7e", "#ffd24d", "#5ec8ff", "#7be08a", "#c77dff", "#ffa64d"];
    const count = opts.count || 130;
    const gravity = opts.gravity != null ? opts.gravity : 0.25;
    const originY = opts.fromTop ? -20 : canvas.height / 3;
    for (let i = 0; i < count; i++) {
      pieces.push({
        x: canvas.width / 2 + (Math.random() - 0.5) * (opts.fromTop ? canvas.width : 120),
        y: opts.fromTop ? originY - Math.random() * 200 : originY + (Math.random() - 0.5) * 40,
        vx: (Math.random() - 0.5) * (opts.fromTop ? 3 : 9),
        vy: opts.fromTop ? Math.random() * 3 + 1 : Math.random() * -9 - 3,
        size: 6 + Math.random() * 8,
        color: colors[Math.floor(Math.random() * colors.length)],
        char: emoji ? emoji[Math.floor(Math.random() * emoji.length)] : null,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.3,
        life: 1,
        gravity,
      });
    }
    if (pieces.length > MAX_PIECES) pieces.splice(0, pieces.length - MAX_PIECES);
    if (!running) { running = true; requestAnimationFrame(loop); }
  }

  global.JoshEffects = {
    confetti: (opts) => burst(opts || {}),
    stars: () => burst({ emoji: ["⭐", "🌟", "✨", "💫"], count: 70, fromTop: true, gravity: 0.05 }),
  };
})(typeof window !== "undefined" ? window : globalThis);
