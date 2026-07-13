// Shared celebration effects for Josh's Games. Exposes
// window.JoshEffects.confetti() and .stars(). Self-contained, no dependencies.
// Respects prefers-reduced-motion (becomes a no-op) in ONE place, so every game
// rewards a win consistently and calmly.

(function (global) {
  function reduceMotion() {
    return global.matchMedia && global.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function burst(opts) {
    opts = opts || {};
    if (reduceMotion()) return;
    if (!global.document || !global.requestAnimationFrame) return;
    const emoji = opts.emoji || null; // if set, draw emoji instead of rects
    const colors = opts.colors || ["#ff5e7e", "#ffd24d", "#5ec8ff", "#7be08a", "#c77dff", "#ffa64d"];
    const count = opts.count || 130;
    const gravity = opts.gravity != null ? opts.gravity : 0.25;

    const canvas = document.createElement("canvas");
    canvas.style.cssText = "position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:60";
    canvas.setAttribute("aria-hidden", "true");
    document.body.appendChild(canvas);
    const ctx = canvas.getContext("2d");
    if (!ctx) { canvas.remove(); return; }
    canvas.width = global.innerWidth;
    canvas.height = global.innerHeight;

    const originY = opts.fromTop ? -20 : canvas.height / 3;
    const pieces = [];
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
      });
    }

    let frames = 0;
    function tick() {
      frames += 1;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let alive = false;
      for (const p of pieces) {
        p.vy += gravity;
        p.vx *= 0.99;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        p.life -= 0.006;
        if (p.life > 0 && p.y < canvas.height + 30) {
          alive = true;
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
        }
      }
      if (alive && frames < 480) requestAnimationFrame(tick);
      else canvas.remove();
    }
    requestAnimationFrame(tick);
  }

  global.JoshEffects = {
    confetti: (opts) => burst(opts || {}),
    stars: () => burst({ emoji: ["⭐", "🌟", "✨", "💫"], count: 70, fromTop: true, gravity: 0.05 }),
  };
})(typeof window !== "undefined" ? window : globalThis);
