// Fort Josh: Toybox Defense — canvas renderer (TD-2.1, artistic pass).
// Reads engine state, never mutates it. ORIENTATION-AWARE: in a portrait
// viewport the FLOOR (bg + path + pads, 24×14 cells) is drawn ROTATED 90° so
// the battlefield fills the tall phone screen; in landscape it draws unrotated.
// Geometry stays in world cells everywhere — worldToScreen/screenToWorld are the
// ONE mapping (taps, bubbles and HUD share it, so rotation can never desync input
// from drawing). Passes per frame:
//   1. FLOOR pass under the rotation transform (baked bg, path, pads, range
//      rings, world particle fx — all rotation-safe circles/lines)
//   2. CHARACTER pass in SCREEN space, UPRIGHT (towers, soldiers, enemies,
//      shells, projectiles, hp bars, glyphs, gold floaters) — so a sock's face
//      and a turret's barrels never render sideways in portrait.
// All motion here is deterministic (tick/id driven) — no Math.random, no state
// mutation; the renderer only ever READS engine state.

(function (global) {
  function create(canvas, engine) {
    const ctx = canvas.getContext("2d");
    const GRID = global.TDData.GRID;
    let cell = 16, dpr = 1, rotated = false, cssW = 0, cssH = 0;
    let selection = null; // {pad?, ghostRange?, tower?}
    const fx = [];        // {kind, x, y, ttl, max, text?} (world coords)
    const prevPos = new Map();
    const prevProj = new Map();
    let bg = null;
    const NIGHT = !!engine.levelDef.night;
    const ZONES = engine.levelDef.zones || null;
    // TD-6 fx juice: a tiny screen-shake on heavy impacts (boss/Bertha/stomp),
    // capped ≤4px and DISABLED under prefers-reduced-motion. Deterministic decay
    // (tick-driven, no Math.random). Damage numbers are opt-in (settings toggle).
    const reduceMotion = !!(global.matchMedia && global.matchMedia("(prefers-reduced-motion: reduce)").matches);
    let shakeTtl = 0, shakeMag = 0;
    let showDmg = false; // set via api.setDamageNumbers
    function triggerShake(mag) {
      if (reduceMotion) return;
      mag = Math.min(4, mag);
      if (mag >= shakeMag * (shakeTtl > 0 ? shakeTtl / 10 : 0)) { shakeMag = mag; shakeTtl = 10; }
    }
    // The range-preview multiplier comes from the ENGINE (it folds in the Night
    // Owl star-tree node) — recomputing it here from RULES would lie once the
    // node is owned.
    const nightMul = engine.rangeMul || 1;
    // TD-7: a level can have multiple lanes; the engine built them all.
    const lanes = engine.levelDef.paths || [engine.levelDef.path];
    const pathTotal = engine.paths[0].total; // primary lane length (decor + fallback)
    // Lever levels: precompute each lane's DIVERGENT middle (the waypoints that
    // are not part of the shared prefix/tail) so the live route overlay can veil
    // exactly the branch the train will NOT take — never the shared segments,
    // which belong to BOTH routes. Padded one shared point each side so the
    // veil stroke visually meets the fork/rejoin.
    let leverSeg = null;
    if (engine.levelDef.lever && lanes.length > 1) {
      const a = lanes[0], b = lanes[1];
      let pre = 0;
      while (pre < a.length && pre < b.length && a[pre][0] === b[pre][0] && a[pre][1] === b[pre][1]) pre += 1;
      let suf = 0;
      while (suf < a.length - pre && suf < b.length - pre &&
             a[a.length - 1 - suf][0] === b[b.length - 1 - suf][0] &&
             a[a.length - 1 - suf][1] === b[b.length - 1 - suf][1]) suf += 1;
      const mid = (arr) => arr.slice(Math.max(0, pre - 1), arr.length - suf + 1);
      leverSeg = { mids: [mid(a), mid(b)] };
    }
    let lastLitLane = -1; // leverInfo() test hook: which lane the overlay lit last draw
    function tangentAt(dist) { const a = engine.posAt(Math.max(0, dist - 0.35)), b = engine.posAt(Math.min(pathTotal, dist + 0.35)); let tx = b.x - a.x, ty = b.y - a.y; const m = Math.hypot(tx, ty) || 1; return { x: tx / m, y: ty / m }; }

    function resize() {
      const parent = canvas.parentElement;
      const vw = parent ? parent.clientWidth : 360;
      // A hidden screen measures 0 wide, and `Math.max(10, …)` would silently
      // rebuild the whole field at the MINIMUM cell — a collapsed battlefield
      // that survives until something resizes again. Keep the last good size
      // instead; the screen resizes for real when it is shown.
      if (parent && vw <= 0 && cssW) return;
      // vertical budget: MEASURED — everything from the wrap's top edge down to
      // the bottom of the viewport is field (the CALL button floats over it, and
      // the site topbar is hidden inside the fort), minus a small safe margin.
      let chromeTop = 250;
      if (parent && parent.getBoundingClientRect) {
        const top = parent.getBoundingClientRect().top;
        if (top > 0) chromeTop = top;
      }
      // …minus anything laid out BELOW the field (the power strip in portrait).
      // Measured generically — an absolutely-positioned control costs nothing, so
      // a future floating widget needs no change here, and an in-flow one is
      // accounted for automatically instead of silently pushing the page taller.
      let below = 0;
      for (let n = parent && parent.nextElementSibling; n; n = n.nextElementSibling) {
        if (n.hidden) continue;
        const cs = global.getComputedStyle ? global.getComputedStyle(n) : null;
        if (cs && (cs.position === "absolute" || cs.position === "fixed")) continue;
        if (n.offsetHeight) below += n.offsetHeight + 8;
      }
      const vh = Math.max(240, (global.innerHeight || 700) - chromeTop - 18 - below);
      rotated = (global.innerHeight || 700) > (global.innerWidth || 360);
      if (rotated) cell = Math.max(10, Math.min(Math.floor(vw / GRID.h), Math.floor(vh / GRID.w)));
      else cell = Math.max(10, Math.min(Math.floor(vw / GRID.w), Math.floor(vh / GRID.h)));
      cssW = cell * (rotated ? GRID.h : GRID.w);
      cssH = cell * (rotated ? GRID.w : GRID.h);
      dpr = Math.min(global.devicePixelRatio || 1, 2);
      canvas.style.width = cssW + "px";
      canvas.style.height = cssH + "px";
      canvas.width = cssW * dpr;
      canvas.height = cssH * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      bg = null;
    }

    // ---- The ONE world↔screen mapping (CSS px, canvas-relative) ----
    function worldToScreen(wx, wy) {
      if (rotated) return { x: cssW - wy * cell, y: wx * cell };
      return { x: wx * cell, y: wy * cell };
    }
    function screenToWorld(sx, sy) {
      if (rotated) return { x: sy / cell, y: (cssW - sx) / cell };
      return { x: sx / cell, y: sy / cell };
    }
    function enterWorld() { // apply the rotation transform for the FLOOR pass
      ctx.save();
      if (rotated) { ctx.translate(cssW, 0); ctx.rotate(Math.PI / 2); }
    }
    function exitWorld() { ctx.restore(); }

    // ---- THE LIGHT ----
    // ONE global light direction for the whole fort. Before this, the field had
    // shading but no LIGHT: every shadow was a centred grey blob, so nothing
    // agreed about where it was lit from and objects read as stickers laid on a
    // plane. A single shared vector is what makes a flat 2D board look designed
    // — every cast shadow offsets along it, every lit edge faces into it.
    //
    // Screen-space and CONSTANT: the floor rotates 90° in portrait but the light
    // must not, or the room would appear to swing when the phone turns. It is
    // declared here, beside the baked floor, because the bake is its first
    // consumer and the entity pass is its second.
    const LIGHT = { x: -0.55, y: -0.84 };            // from upper-left, ON SCREEN
    const SHADOW = { x: -LIGHT.x, y: -LIGHT.y };     // …so shadows fall lower-right

    // …and the FLOOR is not in screen space. The baked plate is world-oriented
    // and gets drawn through a 90° rotation in portrait, so a shadow baked
    // "down-right" comes out pointing down-LEFT on the phone — which is exactly
    // what the first cut of this did, and it is the same +0.5/rotation class of
    // coordinate bug this renderer has been bitten by before. `w2s` maps a world
    // direction (dx,dy) to screen (-dy,dx) when rotated, so the bake must use the
    // INVERSE of that to land on LIGHT once painted. Recomputed at bake time
    // because `rotated` is decided in resize(), which is what triggers the bake.
    const bakeVec = (v) => (rotated ? { x: v.y, y: -v.x } : { x: v.x, y: v.y });

    // ---- Baked floor: gradient, subtle rug texture, the path ribbon, pads ----
    // The EIGHT shared floor primitives. Deliberately a small closed set: eight
    // worlds pick three each from `WORLDS[w].floor.props`, so a ninth world
    // costs a three-item list rather than three new drawings — and each is ≤12
    // canvas ops, painted once into the baked background, so the per-frame cost
    // is exactly zero. Vector only, never emoji: an emoji here would land
    // straight in the ≤13.0 and VS16 scans.
    // A prop, GROUNDED and SHADED. Three things happen here and the order is the
    // point: (1) contact + cast shadow straight onto the floor, (2) the body on
    // its OWN scratch layer, (3) one directional wash clipped to that body with
    // `source-atop`. The scratch layer is what makes (3) legal — running
    // source-atop on the shared background would tint the FLOOR inside the
    // prop's box as well, since the floor is already painted there. It is a
    // bake-time canvas per prop (seven per level, once per resize), so the
    // per-frame cost stays exactly zero.
    function drawProp(b, kind, x, y, u, ink) {
      // CONTACT + CAST. Every prop was a flat shape with nothing under it, so a
      // crate read as a sticker rather than an object in the room. A tight dark
      // core exactly at the base is what plants a thing; the wider soft ellipse
      // thrown along SHADOW is what says where the light is.
      const SH = bakeVec(SHADOW);
      const sx = x + SH.x * u * 0.30, sy = y + SH.y * u * 0.30;
      // A ground shadow is SQUASHED along the screen's vertical — but this is
      // baked into the world-oriented plate, which is drawn through a 90°
      // rotation in portrait, so a flat ellipse in bake space came out as a TALL
      // oval on a phone. The squash axis has to follow the SCREEN, so the
      // ellipse is rotated by whatever the bake does to screen-horizontal.
      // (Same class as the cast direction itself needing bakeVec — invisible in
      // a landscape screenshot, wrong in every portrait one.)
      const bh = bakeVec({ x: 1, y: 0 });
      const rot = Math.atan2(bh.y, bh.x);
      // SIZED TO THE PROP, not to the cell. The first cut threw a 1.24-cell-wide
      // shadow under a 0.68-cell prop — nearly double the thing casting it — and
      // props sit about 3 cells apart, so neighbouring shadows almost touched
      // and the floor read as a row of dark discs with small objects perched on
      // them. A shadow that is bigger than its object stops being a shadow.
      softEllipse(b, sx, sy, u * 0.40, u * 0.21, rot,
        [[0, 0.22], [0.5, 0.13], [0.8, 0.04], [1, 0]]);
      softEllipse(b, x + SH.x * u * 0.06, y + SH.y * u * 0.06, u * 0.25, u * 0.115, rot,
        [[0, 0.26], [0.6, 0.2], [1, 0]]);

      const S = Math.max(8, Math.ceil(u * 1.6));
      const sc = document.createElement("canvas");
      sc.width = Math.ceil(S * dpr); sc.height = Math.ceil(S * dpr);
      const p = sc.getContext("2d");
      p.setTransform(dpr, 0, 0, dpr, 0, 0);
      p.translate(S / 2 - x, S / 2 - y);      // so the body's absolute coords land centred
      drawPropBody(p, kind, x, y, u, ink);
      if (kind !== "stain") {                 // a stain is a mark ON the floor, not a form above it
        p.setTransform(dpr, 0, 0, dpr, 0, 0);
        p.globalCompositeOperation = "source-atop";
        // SCREEN light, not bake light: the blit below is counter-rotated, so
        // this scratch ends up in screen orientation.
        const sh = p.createLinearGradient(S / 2 + LIGHT.x * u * 0.5, S / 2 + LIGHT.y * u * 0.5,
          S / 2 - LIGHT.x * u * 0.5, S / 2 - LIGHT.y * u * 0.5);
        sh.addColorStop(0, "rgba(255,248,232,0.22)");
        sh.addColorStop(0.5, "rgba(255,255,255,0)");
        sh.addColorStop(1, "rgba(0,0,0,0.28)");
        p.fillStyle = sh; p.fillRect(0, 0, S, S);
      }
      // A PROP IS AN OBJECT, NOT FLOOR TEXTURE — so it stands upright, like every
      // character. It is baked into the world-oriented plate for the per-frame
      // cost (which is the right trade), and that plate is drawn through a 90°
      // rotation in portrait, so on a phone every prop was lying on its side: a
      // stack of bricks rendered as three vertical bars standing side by side, a
      // suitcase stood on its end. Counter-rotating the blit by the same angle
      // the shadow ellipse uses cancels the plate exactly, so props are upright
      // in BOTH orientations and the bake stays free.
      b.save();
      b.translate(x, y);
      b.rotate(rot);
      b.drawImage(sc, 0, 0, sc.width, sc.height, -S / 2, -S / 2, S, S);
      b.restore();
    }

    function drawPropBody(b, kind, x, y, u, ink) {
      const dark = "rgba(0,0,0,0.45)";
      b.save();
      b.strokeStyle = ink; b.lineWidth = Math.max(1, u * 0.05);
      if (kind === "box") {                                   // a cardboard carton
        b.fillStyle = "#a97b47"; b.fillRect(x - u * 0.34, y - u * 0.3, u * 0.68, u * 0.58);
        b.fillStyle = "#c08f55"; b.fillRect(x - u * 0.34, y - u * 0.3, u * 0.68, u * 0.16);
        b.strokeRect(x - u * 0.34, y - u * 0.3, u * 0.68, u * 0.58);
        b.beginPath(); b.moveTo(x, y - u * 0.14); b.lineTo(x, y + u * 0.28); b.stroke();
      } else if (kind === "blocks") {                          // a little stack of bricks
        const cols = ["#d95f52", "#4f8fd9", "#e2b23a"];
        for (let i = 0; i < 3; i++) {
          b.fillStyle = cols[i];
          b.fillRect(x - u * 0.3 + (i % 2) * u * 0.1, y + u * 0.24 - (i + 1) * u * 0.18, u * 0.5, u * 0.16);
        }
      } else if (kind === "bush") {                            // a garden shrub
        b.fillStyle = "#2f6b34";
        for (const [dx, dy, r] of [[-0.2, 0.06, 0.26], [0.18, 0.04, 0.24], [0, -0.14, 0.28]]) {
          b.beginPath(); b.arc(x + dx * u, y + dy * u, r * u, 0, 7); b.fill();
        }
        b.fillStyle = "#3f8a42";
        b.beginPath(); b.arc(x - u * 0.06, y - u * 0.16, u * 0.16, 0, 7); b.fill();
      } else if (kind === "stone") {                           // a rounded pebble
        b.fillStyle = "#8d8a83";
        b.beginPath(); b.ellipse(x, y, u * 0.32, u * 0.24, 0.3, 0, 7); b.fill();
        b.fillStyle = "rgba(255,255,255,0.18)";
        b.beginPath(); b.ellipse(x - u * 0.08, y - u * 0.08, u * 0.14, u * 0.08, 0.3, 0, 7); b.fill();
      } else if (kind === "tyre") {                            // a stacked tyre
        b.fillStyle = "#2b2b30";
        b.beginPath(); b.ellipse(x, y, u * 0.34, u * 0.26, 0, 0, 7); b.fill();
        b.fillStyle = "#4a4a52";
        b.beginPath(); b.ellipse(x, y - u * 0.04, u * 0.16, u * 0.12, 0, 0, 7); b.fill();
      } else if (kind === "tin") {                             // a paint/oil tin
        b.fillStyle = "#8f9aa8"; b.fillRect(x - u * 0.24, y - u * 0.26, u * 0.48, u * 0.52);
        b.fillStyle = "#b6c0cc"; b.fillRect(x - u * 0.24, y - u * 0.26, u * 0.48, u * 0.1);
        b.fillStyle = "#c86a3a"; b.fillRect(x - u * 0.24, y - u * 0.04, u * 0.48, u * 0.14);
        b.strokeRect(x - u * 0.24, y - u * 0.26, u * 0.48, u * 0.52);
      } else if (kind === "case") {                            // an old suitcase
        b.fillStyle = "#7a4d33"; b.fillRect(x - u * 0.36, y - u * 0.2, u * 0.72, u * 0.4);
        b.strokeRect(x - u * 0.36, y - u * 0.2, u * 0.72, u * 0.4);
        b.strokeStyle = dark;
        b.beginPath(); b.moveTo(x - u * 0.36, y - u * 0.02); b.lineTo(x + u * 0.36, y - u * 0.02); b.stroke();
        b.beginPath(); b.arc(x, y - u * 0.24, u * 0.09, Math.PI, 0); b.stroke();   // handle
      } else {                                                  // "stain" — a floor mark
        b.fillStyle = ink;
        b.beginPath(); b.ellipse(x, y, u * 0.4, u * 0.22, 0.5, 0, 7); b.fill();
        b.beginPath(); b.ellipse(x + u * 0.26, y + u * 0.14, u * 0.12, u * 0.07, 0.2, 0, 7); b.fill();
      }
      b.restore();
    }

    function bakeBg() {
      bg = document.createElement("canvas");
      const W = cell * GRID.w, H = cell * GRID.h; // WORLD-oriented bake
      bg.width = W * dpr; bg.height = H * dpr;
      const b = bg.getContext("2d");
      b.setTransform(dpr, 0, 0, dpr, 0, 0);
      // The world's own FLOOR. This was one hard-coded blue gradient on all 24
      // levels — the biggest pixel area on screen carrying zero world identity,
      // so the Toy Store and the Garage looked like the same room. The palette
      // and the texture are DATA (WORLDS[w].floor), baked once into this cached
      // canvas, so a per-world floor costs nothing per frame and a new world
      // cannot inherit a blank one.
      const FLOOR = (global.TDData.WORLDS[engine.levelDef.world] || {}).floor
        || { pattern: "carpet", top: "#12213c", bottom: "#1c2c49", ink: "rgba(255,255,255,0.035)" };
      const g = b.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, FLOOR.top); g.addColorStop(1, FLOOR.bottom);
      b.fillStyle = g; b.fillRect(0, 0, W, H);
      // Night used to REPLACE the world's floor with a flat blue-black, throwing
      // away the one surface that says which room you are in — a night level
      // looked like no world at all. It now DIMS the real floor with a cool
      // overlay, so the backyard's grass is still grass after dark.
      if (NIGHT) { b.fillStyle = "rgba(6,10,26,0.72)"; b.fillRect(0, 0, W, H); }
      if (NIGHT) { // scattered firefly glows (baked, deterministic positions)
        for (let i = 0; i < 14; i++) {
          const fx0 = ((i * 137) % (GRID.w * 10)) / 10, fy0 = ((i * 71) % (GRID.h * 10)) / 10;
          const gl = b.createRadialGradient(fx0 * cell, fy0 * cell, 0, fx0 * cell, fy0 * cell, cell * 0.7);
          gl.addColorStop(0, "rgba(200,255,150,0.20)"); gl.addColorStop(1, "rgba(200,255,150,0)");
          b.fillStyle = gl; b.beginPath(); b.arc(fx0 * cell, fy0 * cell, cell * 0.7, 0, 7); b.fill();
        }
      }
      // LIGHT POOLING. The floor was a two-stop vertical gradient across ~75% of
      // the screen — the largest surface in the game carrying almost no
      // information, which is what made every room read as a plane rather than a
      // place. Four broad, deterministic patches (hash-placed, never rng) break
      // that flatness up before any texture goes on top: two warm pools biased
      // toward LIGHT, two cool sinks opposite. Baked, so it is free per frame.
      const pool = (px, py, r, col) => {
        const gp = b.createRadialGradient(px, py, 0, px, py, r);
        gp.addColorStop(0, col); gp.addColorStop(1, col.replace(/[\d.]+\)$/, "0)"));
        b.fillStyle = gp; b.fillRect(0, 0, W, H);
      };
      const warm = NIGHT ? "rgba(150,190,255,0.05)" : "rgba(255,240,205,0.09)";
      const cool = NIGHT ? "rgba(0,0,20,0.16)" : "rgba(20,26,60,0.10)";
      const BL = bakeVec(LIGHT);
      pool(W * (0.5 + BL.x * 0.42), H * (0.5 + BL.y * 0.30), Math.max(W, H) * 0.62, warm);
      pool(W * (0.5 + BL.x * 0.20 + 0.22), H * (0.5 + BL.y * 0.20 - 0.18), Math.max(W, H) * 0.34, warm);
      pool(W * (0.5 - BL.x * 0.34), H * (0.5 - BL.y * 0.36), Math.max(W, H) * 0.52, cool);
      pool(W * (0.5 - BL.x * 0.18 - 0.20), H * (0.5 - BL.y * 0.18 + 0.22), Math.max(W, H) * 0.36, cool);
      // soft vignette so the field feels like a lit playmat — anchored to LIGHT
      // rather than dead-centre, so the bright spot agrees with everything else
      const vig = b.createRadialGradient(
        W * (0.5 + BL.x * 0.14), H * (0.5 + BL.y * 0.10), Math.min(W, H) * 0.16,
        W / 2, H / 2, Math.max(W, H) * 0.60);
      vig.addColorStop(0, "rgba(255,255,255,0.07)");
      vig.addColorStop(0.55, "rgba(0,0,0,0.04)");
      vig.addColorStop(1, "rgba(0,0,0,0.30)");
      b.fillStyle = vig; b.fillRect(0, 0, W, H);
      // ---- the world's floor TEXTURE (baked; deterministic, no rng) ----
      // A cheap hash so speckle is stable across reloads and across the
      // determinism suite — Math.random is banned everywhere in this project.
      const spot = (i, m) => ((i * 2654435761) % m) / m;
      const ink = NIGHT ? "rgba(255,255,255,0.03)" : FLOOR.ink;
      b.save();
      if (FLOOR.pattern === "carpet") {
        // Short pile with a faint vacuum-stripe nap. THE BEDROOM DECLARED THIS
        // AND NO BRANCH EXISTED, so World 1 — the first floor anybody sees, and
        // the one a new player judges the whole game by — rendered as a bare
        // gradient with no texture at all. Exactly the class already documented
        // for the spawn marker's if/else falling through to the bedroom's bed:
        // a data field with no implementation fails silently, and the floor
        // guardrail's hash still passed because the palette alone differs.
        const band = cell * 2.2;
        for (let x = 0; x < W; x += band) {
          b.fillStyle = ((x / band) | 0) % 2 ? "rgba(255,255,255,0.022)" : "rgba(0,0,0,0.035)";
          b.fillRect(x, 0, band, H);
        }
        b.strokeStyle = ink; b.lineWidth = Math.max(1, cell * 0.03); b.lineCap = "round";
        for (let i = 0; i < 520; i++) {
          const x = spot(i + 13, 991) * W, y = spot(i + 57, 883) * H;
          const len = cell * (0.06 + spot(i + 5, 61) * 0.07);
          const lean = (spot(i + 23, 47) - 0.5) * cell * 0.06;
          b.beginPath(); b.moveTo(x, y); b.lineTo(x + lean, y - len); b.stroke();
        }
      } else if (FLOOR.pattern === "grass") {
        // tufts of blades, denser toward the bottom so the lawn has depth
        b.strokeStyle = ink; b.lineWidth = Math.max(1, cell * 0.045); b.lineCap = "round";
        for (let i = 0; i < 420; i++) {
          const x = spot(i + 7, 997) * W, y = spot(i + 91, 887) * H;
          const len = cell * (0.16 + spot(i + 3, 71) * 0.2), lean = (spot(i + 17, 53) - 0.5) * cell * 0.22;
          b.beginPath(); b.moveTo(x, y); b.lineTo(x + lean, y - len); b.stroke();
        }
      } else if (FLOOR.pattern === "tile") {
        // big polished squares with a bright bevel on two sides — a shop floor
        const t = cell * 2;
        for (let y = 0; y < H; y += t) for (let x = 0; x < W; x += t) {
          const alt = ((x / t) + (y / t)) % 2 < 1;
          b.fillStyle = alt ? "rgba(255,255,255,0.035)" : "rgba(0,0,0,0.06)";
          b.fillRect(x, y, t, t);
          b.strokeStyle = ink; b.lineWidth = 1;
          b.beginPath(); b.moveTo(x, y); b.lineTo(x + t, y); b.moveTo(x, y); b.lineTo(x, y + t); b.stroke();
        }
      } else if (FLOOR.pattern === "boards") {
        // long planks with dark seams, staggered butt-joints and nail heads
        const bh = cell * 1.6;
        for (let y = 0, row = 0; y < H; y += bh, row++) {
          b.strokeStyle = ink; b.lineWidth = Math.max(1, cell * 0.05);
          b.beginPath(); b.moveTo(0, y); b.lineTo(W, y); b.stroke();
          const off = (row % 2 ? cell * 5 : 0);
          for (let x = off; x < W; x += cell * 9) {
            b.beginPath(); b.moveTo(x, y); b.lineTo(x, y + bh); b.stroke();
            b.fillStyle = "rgba(255,235,200,0.13)";
            b.beginPath(); b.arc(x + cell * 0.4, y + bh * 0.5, Math.max(1, cell * 0.045), 0, 7); b.fill();
            b.beginPath(); b.arc(x + cell * 8.6, y + bh * 0.5, Math.max(1, cell * 0.045), 0, 7); b.fill();
          }
        }
      } else if (FLOOR.pattern === "concrete") {
        // expansion joints on a big grid + oil speckle
        b.strokeStyle = ink; b.lineWidth = Math.max(1, cell * 0.07);
        for (let y = 0; y < H; y += cell * 4) { b.beginPath(); b.moveTo(0, y); b.lineTo(W, y); b.stroke(); }
        for (let x = 0; x < W; x += cell * 5) { b.beginPath(); b.moveTo(x, 0); b.lineTo(x, H); b.stroke(); }
        for (let i = 0; i < 260; i++) {
          const x = spot(i + 13, 991) * W, y = spot(i + 57, 883) * H;
          b.fillStyle = spot(i, 31) > 0.6 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.14)";
          b.beginPath(); b.arc(x, y, cell * (0.03 + spot(i + 5, 23) * 0.06), 0, 7); b.fill();
        }
      } else if (FLOOR.pattern === "cardboard") {
        // corrugation flutes + a few strips of packing tape
        b.strokeStyle = ink; b.lineWidth = Math.max(1, cell * 0.05);
        for (let x = 0; x < W; x += cell * 0.55) { b.beginPath(); b.moveTo(x, 0); b.lineTo(x, H); b.stroke(); }
        b.strokeStyle = "rgba(255,255,255,0.07)"; b.lineWidth = Math.max(1, cell * 0.03);
        for (let x = cell * 0.2; x < W; x += cell * 0.55) { b.beginPath(); b.moveTo(x, 0); b.lineTo(x, H); b.stroke(); }
        b.fillStyle = "rgba(240,225,190,0.10)";
        for (let i = 0; i < 5; i++) {
          const y = (spot(i + 21, 97)) * H;
          b.fillRect(0, y, W, cell * 0.55);
          b.strokeStyle = "rgba(255,255,255,0.09)"; b.lineWidth = 1;
          b.beginPath(); b.moveTo(0, y); b.lineTo(W, y); b.moveTo(0, y + cell * 0.55); b.lineTo(W, y + cell * 0.55); b.stroke();
        }
      } else if (FLOOR.pattern === "grating") {
        // cold steel grating: diamond-plate lozenges on cross-bands, with a warm
        // sodium-lamp pool top-left so the plant reads as lit from one fixture
        b.strokeStyle = "rgba(0,0,0,0.35)"; b.lineWidth = Math.max(1, cell * 0.06);
        for (let y = 0; y < H; y += cell * 1.1) { b.beginPath(); b.moveTo(0, y); b.lineTo(W, y); b.stroke(); }
        for (let x = 0; x < W; x += cell * 3.2) { b.beginPath(); b.moveTo(x, 0); b.lineTo(x, H); b.stroke(); }
        b.strokeStyle = ink; b.lineWidth = Math.max(1, cell * 0.05);
        for (let y = cell * 0.55, row = 0; y < H; y += cell * 1.1, row++) {
          for (let x = (row % 2 ? cell * 0.55 : 0); x < W; x += cell * 1.1) {
            b.beginPath();
            b.moveTo(x, y - cell * 0.2); b.lineTo(x + cell * 0.28, y); b.lineTo(x, y + cell * 0.2); b.lineTo(x - cell * 0.28, y);
            b.closePath(); b.stroke();
          }
        }
        const lamp = b.createRadialGradient(W * 0.22, H * 0.16, 0, W * 0.22, H * 0.16, Math.max(W, H) * 0.55);
        lamp.addColorStop(0, "rgba(255,196,110,0.16)"); lamp.addColorStop(1, "rgba(255,196,110,0)");
        b.fillStyle = lamp; b.fillRect(0, 0, W, H);
      } else if (FLOOR.pattern === "mould") {
        // the factory floor: a grid of MOULD CAVITIES — rounded wells sunk into
        // an oiled steel bed, each with a highlight on its upper lip so it reads
        // as recessed rather than printed. Its own pattern rather than a
        // re-tinted "grating": the floor guardrail hashes the lane CORRIDOR as
        // well as the canvas, and three worlds once shipped an identical road
        // because none of them declared one.
        b.strokeStyle = "rgba(0,0,0,0.30)"; b.lineWidth = Math.max(1, cell * 0.05);
        for (let y = 0; y < H; y += cell * 1.6) { b.beginPath(); b.moveTo(0, y); b.lineTo(W, y); b.stroke(); }
        for (let x = 0; x < W; x += cell * 1.6) { b.beginPath(); b.moveTo(x, 0); b.lineTo(x, H); b.stroke(); }
        for (let y = cell * 0.8, row = 0; y < H; y += cell * 1.6, row++) {
          for (let x = (row % 2 ? cell * 0.8 : cell * 1.6); x < W; x += cell * 3.2) {
            b.fillStyle = "rgba(0,0,0,0.26)";                       // the well
            b.beginPath(); b.ellipse(x, y, cell * 0.42, cell * 0.30, 0, 0, 7); b.fill();
            b.strokeStyle = ink; b.lineWidth = Math.max(1, cell * 0.05);
            b.beginPath(); b.ellipse(x, y - cell * 0.05, cell * 0.42, cell * 0.30, 0, Math.PI, 2 * Math.PI); b.stroke();
          }
        }
        const heat = b.createRadialGradient(W * 0.78, H * 0.82, 0, W * 0.78, H * 0.82, Math.max(W, H) * 0.6);
        heat.addColorStop(0, "rgba(255,140,50,0.13)"); heat.addColorStop(1, "rgba(255,140,50,0)");
        b.fillStyle = heat; b.fillRect(0, 0, W, H);
      } else if (FLOOR.pattern === "dropcloth") {
        // a painter's dust sheet: coarse canvas weave, creases where it was
        // folded, and a few dried paint spatters
        b.strokeStyle = ink; b.lineWidth = 1;
        for (let y = 0; y < H; y += cell * 0.3) { b.beginPath(); b.moveTo(0, y); b.lineTo(W, y); b.stroke(); }
        for (let x = 0; x < W; x += cell * 0.3) { b.beginPath(); b.moveTo(x, 0); b.lineTo(x, H); b.stroke(); }
        b.strokeStyle = "rgba(255,250,240,0.10)"; b.lineWidth = Math.max(2, cell * 0.09);
        for (let i = 0; i < 4; i++) {   // fold creases
          const y = spot(i + 31, 89) * H;
          b.beginPath(); b.moveTo(0, y); b.lineTo(W, y + cell * 0.3); b.stroke();
        }
        const paints = ["rgba(210,120,110,0.16)", "rgba(120,170,210,0.16)", "rgba(230,205,120,0.16)"];
        for (let i = 0; i < 90; i++) {
          const x = spot(i + 61, 971) * W, y = spot(i + 19, 859) * H;
          b.fillStyle = paints[i % paints.length];
          b.beginPath(); b.arc(x, y, cell * (0.05 + spot(i + 9, 37) * 0.14), 0, 7); b.fill();
        }
      } else {
        // carpet: the original faint weave, now on the world's own palette
        b.strokeStyle = ink; b.lineWidth = 1;
        for (let y = 0; y < GRID.h; y += 1) { b.beginPath(); b.moveTo(0, y * cell); b.lineTo(W, y * cell); b.stroke(); }
        for (let x = 0; x < GRID.w; x += 1) { b.beginPath(); b.moveTo(x * cell, 0); b.lineTo(x * cell, H); b.stroke(); }
        b.fillStyle = "rgba(255,255,255,0.03)";
        for (let i = 0; i < 300; i++) {
          const x = spot(i + 11, 983) * W, y = spot(i + 43, 877) * H;
          b.fillRect(x, y, Math.max(1, cell * 0.06), Math.max(1, cell * 0.06));
        }
      }
      b.restore();

      b.lineCap = "round"; b.lineJoin = "round";
      const primaryPath = lanes[0];
      // `dy` offsets the whole polyline, which is what gives the road a real lit
      // CROSS-SECTION instead of three concentric same-centred tan bands.
      const ribbon = (path, width, color, dash, dy) => {
        b.strokeStyle = color; b.lineWidth = width;
        if (dash) b.setLineDash(dash); else b.setLineDash([]);
        const o = dy || 0;
        b.beginPath();
        b.moveTo((path[0][0] + 0.5) * cell, (path[0][1] + 0.5) * cell + o);
        for (const [x, y] of path.slice(1)) b.lineTo((x + 0.5) * cell, (y + 0.5) * cell + o);
        b.stroke();
      };
      // The lane is 19.4% of the canvas — the second-biggest surface after the
      // floor, and the one the eye tracks for a whole run — and it was four flat
      // strokes plus a highway dash, so three worlds shipped the SAME road and a
      // 56-cell serpentine gave no cue whether you were on a straight or a curve.
      // `style` is a data field on the world (mirroring `floor.pattern`), so a new
      // world declares its road instead of inheriting the shared wood.
      const roadTexture = (path, ROAD) => {
        const style = ROAD.style || "plain";
        if (style === "plain") return;
        const tie = ROAD.tie || "rgba(58,40,22,0.26)";
        // Walk the polyline by arc length so spacing is even through corners.
        let carry = 0;
        for (let i = 1; i < path.length; i++) {
          const ax = (path[i - 1][0] + 0.5) * cell, ay = (path[i - 1][1] + 0.5) * cell;
          const bx = (path[i][0] + 0.5) * cell, by = (path[i][1] + 0.5) * cell;
          const len = Math.hypot(bx - ax, by - ay);
          if (!len) continue;
          const ux = (bx - ax) / len, uy = (by - ay) / len;   // tangent
          const nx = -uy, ny = ux;                            // normal
          const step = cell * (style === "ties" ? 0.62 : style === "plates" ? 0.88 : 0.9);
          for (let d = carry; d < len; d += step) {
            const px = ax + ux * d, py = ay + uy * d;
            if (style === "ties") {                            // wooden sleepers
              b.strokeStyle = tie; b.lineWidth = Math.max(2, cell * 0.13);
              b.beginPath();
              b.moveTo(px + nx * cell * 0.45, py + ny * cell * 0.45);
              b.lineTo(px - nx * cell * 0.45, py - ny * cell * 0.45);
              b.stroke();
            } else if (style === "plates") {                   // bolted steel floor plates
              // Deliberately NOT a moving belt: a belt road would read as the
              // conveyor GIMMICK, and a mechanic you cannot tell from a
              // decoration is the side-door defect all over again. Static plates
              // with bolt heads say "factory floor" and imply no direction.
              b.save();
              b.translate(px, py);
              b.rotate(Math.atan2(uy, ux));
              b.strokeStyle = tie; b.lineWidth = Math.max(1.5, cell * 0.06);
              b.beginPath(); b.rect(-cell * 0.42, -cell * 0.44, cell * 0.84, cell * 0.88); b.stroke();
              b.fillStyle = tie;                                     // four bolt heads
              for (const sx of [-0.30, 0.30]) for (const sy of [-0.32, 0.32]) {
                b.beginPath(); b.arc(sx * cell, sy * cell, Math.max(1, cell * 0.055), 0, 7); b.fill();
              }
              b.restore();
            } else if (style === "stones") {                   // flagstones, staggered
              const off = (Math.round(d / step) % 2 ? 0.18 : -0.18) * cell;
              b.save();
              b.translate(px + nx * off, py + ny * off);
              b.rotate(Math.atan2(uy, ux));
              b.fillStyle = tie;
              b.beginPath(); b.rect(-cell * 0.31, -cell * 0.22, cell * 0.62, cell * 0.44); b.fill();
              b.strokeStyle = "rgba(255,255,255,0.16)"; b.lineWidth = 1;
              b.beginPath(); b.moveTo(-cell * 0.31, -cell * 0.22); b.lineTo(cell * 0.31, -cell * 0.22); b.stroke();
              b.restore();
            }
          }
          carry = (carry - len) % step; if (carry < 0) carry += step;
        }
        if (style === "tape") {                                // two marked-out edges
          b.strokeStyle = tie; b.lineWidth = Math.max(1.5, cell * 0.05);
          for (const s of [-0.30, 0.30]) ribbon(path, Math.max(1.5, cell * 0.05), tie, [cell * 0.5, cell * 0.35], s * cell);
        }
        b.setLineDash([]);
      };
      // ---- decorative floor PROPS, baked under the lane ----
      // Three quarters of every board was bare: the lane takes ~65 of 336 cells
      // and the pads ≤14, so the Bedroom, the Garage and Moving Day were told
      // apart by a palette and a hatch pattern alone and the field read as a
      // diagram rather than a room. WHERE they go is decided purely, in the
      // engine (TDLogic.propCells — no rng, no cell size, clearance measured
      // against EVERY lane); WHAT they look like is eight shared primitives, so
      // eight worlds cost eight three-item lists rather than 24 drawings.
      //
      // Readability first: baked so they never move, ≤0.62 alpha, tinted toward
      // the floor, never the pads' blue-steel, never a face, and ≥1.6 cells from
      // any lane so they never touch the corridor an enemy walks. Drawn BEFORE
      // the lanes and pads, so anything that matters paints over them.
      const PROPS = FLOOR.props;
      if (PROPS && global.TDLogic && global.TDLogic.propCells) {
        const ink2 = FLOOR.propInk || "rgba(0,0,0,0.34)";
        b.save();
        b.globalAlpha = NIGHT ? 0.38 : 0.62;
        for (const p of global.TDLogic.propCells(engine.levelDef, GRID)) {
          const px = (p.x + 0.5) * cell, py = (p.y + 0.5) * cell, u = cell * p.s;
          // NO shadow here. There used to be one — a flat-alpha, hard-edged
          // ellipse — and when the lighting pass gave `drawProp` its own cast and
          // contact it was never removed, so every prop carried THREE shadows
          // from TWO owners. Worse, this one was drawn in bake space with no
          // counter-rotation, so on a phone it came out as a tall oval sitting
          // beside the prop instead of under it: the floor read as a row of dark
          // discs with small objects perched next to them. `drawProp` is the one
          // owner of a prop's shading.
          drawProp(b, PROPS[p.kind % PROPS.length], px, py, u, ink2);
        }
        b.restore();
      }
      // TD-7: secondary lanes (the lever's "switch track") beneath, in a cooler
      // steel-blue so the alternate route reads as a toy train siding.
      for (let i = lanes.length - 1; i >= 1; i--) {
        ribbon(lanes[i], cell * 1.12, "#243244");
        ribbon(lanes[i], cell * 0.9, "#4d6b86");
        ribbon(lanes[i], Math.max(2, cell * 0.08), "rgba(180,220,255,0.5)", [cell * 0.28, cell * 0.28]);
      }
      // the primary (default) lane on top: a warm wooden toy-road, re-tinted per
      // world where the room calls for it (a garden path, bare attic boards, a
      // strip of packing tape) — the default keeps the original toy-road wood.
      const ROAD = FLOOR.road || { edge: "#3c2f22", base: "#caa268", top: "#e0bd83" };
      // AMBIENT TRENCH. The road had a contact shadow hugging its own edge but
      // the FLOOR beside it was untouched, so the lane read as a decal printed on
      // the room rather than a path worn into it. Three widening, fading passes
      // fake a soft occlusion falloff without a blur filter — `ctx.filter` is the
      // documented WebKit rasterisation cliff and this file uses none.
      ribbon(primaryPath, cell * 2.05, "rgba(0,0,0,0.055)", null, cell * 0.10);
      ribbon(primaryPath, cell * 1.70, "rgba(0,0,0,0.075)", null, cell * 0.10);
      ribbon(primaryPath, cell * 1.46, "rgba(0,0,0,0.10)", null, cell * 0.10);
      ribbon(primaryPath, cell * 1.30, "rgba(0,0,0,0.30)", null, cell * 0.10); // contact shadow
      ribbon(primaryPath, cell * 1.16, ROAD.edge);                              // kerb
      ribbon(primaryPath, cell * 1.0, ROAD.base);                               // base
      ribbon(primaryPath, cell * 0.66, ROAD.top, null, -cell * 0.08);           // lit crown
      // The white centre dash is GONE: it duplicated the lever's own running
      // dashes on the six fork levels, and the per-world texture is a stronger
      // centre cue than a highway line on a toy road.
      roadTexture(primaryPath, ROAD);
      b.setLineDash([]);
      // spawn/exit endcaps tinted so the route reads at a glance (lanes share both)
      const cap = (pt, color) => { b.fillStyle = color; b.beginPath(); b.arc((pt[0] + 0.5) * cell, (pt[1] + 0.5) * cell, cell * 0.6, 0, 7); b.fill(); };
      cap(primaryPath[0], "rgba(120,170,255,0.25)");
      // THE DOOR. This is the only way you lose a sticker, and it was a faint
      // green dot the same size as the spawn — indistinguishable from it, on a
      // board where the whole point is stopping things reaching here. Now it is a
      // striped threshold across the lane with a warning glow, so "past this line
      // costs you" is legible before it happens.
      {
        const e0 = primaryPath[primaryPath.length - 1], e1 = primaryPath[primaryPath.length - 2] || e0;
        const ex = (e0[0] + 0.5) * cell, ey = (e0[1] + 0.5) * cell;
        const ux = Math.sign(e0[0] - e1[0]), uy = Math.sign(e0[1] - e1[1]);
        const nx = -uy, ny = ux;
        const gl = b.createRadialGradient(ex, ey, 0, ex, ey, cell * 1.5);
        gl.addColorStop(0, "rgba(255,120,110,0.34)"); gl.addColorStop(1, "rgba(255,120,110,0)");
        b.fillStyle = gl; b.beginPath(); b.arc(ex, ey, cell * 1.5, 0, 7); b.fill();
        b.save();
        b.lineCap = "butt";
        for (let i = -3; i <= 3; i++) {                 // hazard stripes across the lane
          b.strokeStyle = i % 2 ? "rgba(255,238,120,0.85)" : "rgba(40,32,20,0.85)";
          b.lineWidth = Math.max(2, cell * 0.16);
          const t = i * cell * 0.16;
          b.beginPath();
          b.moveTo(ex + nx * cell * 0.58 + ux * t, ey + ny * cell * 0.58 + uy * t);
          b.lineTo(ex - nx * cell * 0.58 + ux * t, ey - ny * cell * 0.58 + uy * t);
          b.stroke();
        }
        b.restore();
      }

      // build pads: bolted steel sockets that clearly say "build here"
      for (const p of engine.levelDef.pads) {
        const px = (p.cx + 0.5) * cell, py = (p.cy + 0.5) * cell;
        b.fillStyle = "rgba(0,0,0,0.22)";
        b.beginPath(); b.ellipse(px, py + cell * 0.12, cell * 0.44, cell * 0.2, 0, 0, 7); b.fill();
        b.fillStyle = "#334a6b";
        b.beginPath(); b.arc(px, py, cell * 0.4, 0, 7); b.fill();
        b.fillStyle = "#3f5c85";
        b.beginPath(); b.arc(px, py, cell * 0.32, 0, 7); b.fill();
        b.setLineDash([cell * 0.14, cell * 0.12]);
        b.strokeStyle = "rgba(197,222,255,0.5)"; b.lineWidth = Math.max(1.5, cell * 0.05);
        b.beginPath(); b.arc(px, py, cell * 0.22, 0, 7); b.stroke();
        b.setLineDash([]);
        b.strokeStyle = "rgba(197,222,255,0.75)"; b.lineWidth = Math.max(1.5, cell * 0.06); b.lineCap = "round";
        b.beginPath(); b.moveTo(px - cell * 0.1, py); b.lineTo(px + cell * 0.1, py);
        b.moveTo(px, py - cell * 0.1); b.lineTo(px, py + cell * 0.1); b.stroke();
        // corner bolts
        b.fillStyle = "#2b3f5c";
        for (let k = 0; k < 4; k++) {
          const a = Math.PI / 4 + k * Math.PI / 2;
          b.beginPath(); b.arc(px + Math.cos(a) * cell * 0.34, py + Math.sin(a) * cell * 0.34, cell * 0.045, 0, 7); b.fill();
        }
        // TD-16 ⚡ POWER PAD: a live socket. Whatever is built here is
        // permanently buffed, so it has to look different from twenty feet away
        // — an amber ring, a spark, and a wired lead running off the plate.
        if (p.boost) {
          b.strokeStyle = "rgba(255,196,84,0.95)"; b.lineWidth = Math.max(2, cell * 0.08);
          b.beginPath(); b.arc(px, py, cell * 0.44, 0, 7); b.stroke();
          b.strokeStyle = "rgba(255,196,84,0.35)"; b.lineWidth = Math.max(1.5, cell * 0.05);
          b.beginPath(); b.arc(px, py, cell * 0.55, 0, 7); b.stroke();
          b.fillStyle = "#ffd35c";                       // the spark in the socket
          b.beginPath();
          b.moveTo(px - cell * 0.07, py - cell * 0.16); b.lineTo(px + cell * 0.05, py - cell * 0.03);
          b.lineTo(px - cell * 0.01, py - cell * 0.01); b.lineTo(px + cell * 0.07, py + cell * 0.16);
          b.lineTo(px - cell * 0.05, py + cell * 0.02); b.lineTo(px + cell * 0.01, py + cell * 0.0);
          b.closePath(); b.fill();
          b.strokeStyle = "rgba(255,196,84,0.6)"; b.lineWidth = Math.max(1.5, cell * 0.045); // the lead
          b.beginPath();
          b.moveTo(px + cell * 0.42, py + cell * 0.16);
          b.quadraticCurveTo(px + cell * 0.72, py + cell * 0.34, px + cell * 0.62, py + cell * 0.6);
          b.stroke();
        }
      }

      // THE GRADE, last. One warm-to-cool wash across the whole plate, aligned
      // with LIGHT, so the nine worlds read as one game shot under one lamp
      // instead of nine unrelated palettes. Deliberately a baked overlay and NOT
      // a CSS/canvas `filter`: a filter on something rendered every frame is the
      // WebKit rasterisation cliff this repo has already paid for once.
      const GL = bakeVec(LIGHT);
      const grade = b.createLinearGradient(
        W * (0.5 + GL.x * 0.5), H * (0.5 + GL.y * 0.5),
        W * (0.5 - GL.x * 0.5), H * (0.5 - GL.y * 0.5));
      grade.addColorStop(0, NIGHT ? "rgba(120,165,255,0.055)" : "rgba(255,224,170,0.065)");
      grade.addColorStop(0.5, "rgba(255,255,255,0)");
      grade.addColorStop(1, NIGHT ? "rgba(0,4,24,0.10)" : "rgba(28,20,60,0.075)");
      b.fillStyle = grade; b.fillRect(0, 0, W, H);
    }

    // ---------- shared bits ----------
    // Every unit on the field — 51 enemy types, 4 tower lines, soldiers, the
    // squad, bosses — goes through this ONE helper, which is why it is where the
    // lighting model belongs: 50 call sites inherit direction for free, exactly
    // as they inherited the ink line. It used to paint a single flat ellipse
    // dead under the body, so nothing on the board agreed about where the light
    // was and every unit read as a sticker.
    //
    // Two ellipses, same as the props: a soft CAST thrown along SHADOW (which is
    // screen-space here — characters are drawn upright in an unrotated context,
    // unlike the baked floor), plus a tight CONTACT core at the base. The cast
    // uses a radial gradient rather than a blur, because `ctx.filter` is the
    // documented WebKit rasterisation cliff and this renderer uses none.
    // A soft ELLIPTICAL falloff, drawn in unit space. The first cut paired a
    // CIRCULAR gradient (radius max(rx,ry)) with an ELLIPTICAL fill, so on the
    // short axis the ellipse cut the gradient off partway down its ramp: at a
    // typical rx=10, ry=3 the boundary still carried ~0.25 alpha, leaving a
    // hard-edged dark disc that read as a sticker on the floor rather than as
    // shade. With a unit-circle gradient under a translate+scale, the falloff is
    // elliptical BY CONSTRUCTION and reaches exactly zero at the boundary, so
    // there is no edge to see — and the shadow takes the shape of the footprint
    // instead of always being a circle.
    function softEllipse(c, cx, cy, rx, ry, rot, stops) {
      if (!(rx > 0.05) || !(ry > 0.05)) return;
      c.save();
      c.translate(cx, cy);
      if (rot) c.rotate(rot);
      c.scale(rx, ry);
      const g = c.createRadialGradient(0, 0, 0, 0, 0, 1);
      for (const [at, a] of stops) g.addColorStop(at, "rgba(0,0,0," + a + ")");
      c.fillStyle = g;
      c.beginPath(); c.arc(0, 0, 1, 0, 7); c.fill();
      c.restore();
    }
    function shadow(x, y, rx, ry) {
      noInk(() => {
        const ox = x + SHADOW.x * rx * 0.55, oy = y + SHADOW.y * ry * 0.75;
        // the thrown cast…
        softEllipse(ctx, ox, oy, rx * 1.35, ry * 1.35, 0,
          [[0, 0.30], [0.45, 0.19], [0.78, 0.06], [1, 0]]);
        // …and the contact core, which plants the body. It covers the WHOLE
        // footprint, not a shrunken disc: shrinking it to 0.8x turned the
        // silhouette guardrail red on the Grease Racer — a genuinely useful
        // failure, because it showed that sprite's contour was passing on
        // darkness BORROWED from its own drop shadow rather than on its own ink.
        // Occlusion under a body covers the body, so full size is also the
        // physically right answer. It is feathered rather than flat-filled for
        // the same reason as the cast: a constant-alpha ellipse has a hard rim.
        softEllipse(ctx, x, y, rx * 1.12, ry * 1.12, 0,
          [[0, 0.30], [0.62, 0.26], [1, 0]]);
      });
    }

    // ---------- THE SILHOUETTE LAW ----------
    // Measured WCAG contrast of each enemy's dominant body colour against the
    // lane it actually walks on: acorn 1.05:1, housekey 1.06:1, yoyo 1.14:1,
    // chair 1.27:1, marble 1.43:1, sock 1.58:1. EVERY lane in every world is a
    // light tan, so a pale body is structurally invisible — it is not one bad
    // colour choice, it is the whole roster against the whole road. Two sprites
    // already carried a hand-added rim (`wad`, `peanut`) precisely because their
    // swarms vanished; the comment on `peanut` says so.
    //
    // Rather than bolt a `rim()` call onto each of the 45 draw branches — which
    // a 46th enemy would not inherit, the failure mode this project keeps
    // re-learning — the ink line is applied by INTERCEPTING the enemy pass:
    // inside `withInk()` every `fill()` is preceded by a stroke of the same path
    // in near-black. One mechanism, every present AND future sprite, and the
    // draw branches stay pure art. `noInk()` opts a call out (ground shadows,
    // reveal glows, hp bars — things that must not be outlined).
    //
    // RIM is 7.7:1 – 12.5:1 against every lane in the game (luminance 0.387
    // attic → 0.661 New House), and at 390px an enemy is ~17px across, where
    // outline and hue are the ONLY channels that still resolve — eye dots are
    // 1.3px. So this is the one art change that survives at phone scale.
    const RIM = "rgba(26,18,10,0.92)";
    // The ink line's counterpart. Warm and translucent so it reads as light
    // falling on a body rather than a white outline drawn around one — a solid
    // pen here turns every sprite into a sticker with a border, which is the
    // exact look this pass exists to remove.
    const LITEDGE = "rgba(255,246,224,0.30)";
    const INK_PER_SPRITE = Number(global.__INK_BUDGET || 4);
    let inkDepth = 0, inkOff = 0, inkBudget = 0, litOn = false, flashOn = 0;
    const canInk = (function () {
      // Feature-checked: shadow the accessor on the instance so the art's 254
      // colour assignments need no edits. Safari 14.0 has these as prototype
      // accessors (standard WebIDL), but if a browser ever hides them the
      // renderer must still draw — just without the ink line.
      const proto = Object.getPrototypeOf(ctx);
      const fill = proto && Object.getOwnPropertyDescriptor(proto, "fillStyle");
      if (!fill || !fill.set || !fill.get || typeof ctx.stroke !== "function") return false;
      const realFill = ctx.fill.bind(ctx);
      const realStroke = ctx.stroke.bind(ctx);
      let busy = false;   // the fill path strokes internally; don't recurse
      const pen = (w) => {
        const ps = ctx.strokeStyle, pw = ctx.lineWidth, pj = ctx.lineJoin, pc = ctx.lineCap;
        ctx.strokeStyle = RIM; ctx.lineWidth = w; ctx.lineJoin = "round"; ctx.lineCap = "round";
        busy = true; realStroke(); busy = false;
        ctx.strokeStyle = ps; ctx.lineWidth = pw; ctx.lineJoin = pj; ctx.lineCap = pc;
      };
      ctx.fill = function (rule) {
        const out = rule === undefined ? realFill() : realFill(rule);
        // THE HIT FLASH, on the interception that already exists. Shots landed
        // with a poof in the AIR and no reaction from the body they hit, so on a
        // 14-tower board you saw sparks near things rather than things being
        // shot. Re-filling the path that was just filled whitens the sprite —
        // no clip, no filter, no per-enemy art, so all 51 bodies and any 52nd
        // inherit it. Deliberately EVERY fill, not just the first (unlike the
        // ink line): flashing only the primary shape reads as a hole punched in
        // the body rather than the body lighting up.
        //   Cost is bounded by how many bodies are flashing at once, not by the
        // enemy count — a flash lives 4 ticks, so at the peak it is a handful of
        // sprites, and it skips the clip() that made the lit edge dear.
        if (flashOn > 0 && inkDepth > 0 && !inkOff && !busy) {
          const pf = ctx.fillStyle;
          ctx.fillStyle = "rgba(255,246,214," + flashOn.toFixed(2) + ")";   // hot, not pure white
          busy = true; if (rule === undefined) realFill(); else realFill(rule); busy = false;
          ctx.fillStyle = pf;
        }
        // FILL FIRST, then stroke — the order the two hand-rimmed sprites (`wad`,
        // `peanut`) already used. Stroking first puts half the pen UNDER the body,
        // so at dpr 1 only ~0.7px of a 1.35px line survived and the measured
        // boundary stayed as bright as the body: the guardrail caught that on its
        // first run, with 35 of 45 types still pale.
        //
        // ONE stroke per sprite, not one per fill. The first cut inked EVERY fill,
        // which is ~8 per enemy and ~800 extra round-joined strokes per frame at
        // the 125-enemy peak. It measured fine (2.15 → 3.51 ms of a 16.7 ms budget)
        // — but on CHROMIUM, which is GPU-accelerated, while Josh's iPad and CI's
        // real-WebKit run rasterize in software where wide round-joined strokes are
        // far dearer. That is exactly the trap this repo documents: never conclude
        // an iOS cost from a Chromium measurement. `inkArmed` is set once per
        // sprite and consumed by its first real fill (shadows and reveal glows go
        // through noInk, so they cannot eat it), which is the primary body — so the
        // cost is ONE extra stroke per enemy, ~45/frame, and the guardrail still
        // proves every type's contour is dark.
        if (inkDepth > 0 && !inkOff && !busy && inkBudget > 0) {
          inkBudget--;
          pen(Math.max(1.5, cell * 0.07));
          // …and the LIT EDGE, on the same sprite, from the same budget. The ink
          // line gives every body a dark contour; this gives it a light SIDE, so
          // the two together read as a form under a lamp rather than a flat
          // shape with an outline. It is the identical path, stroked a second
          // time thinner and offset toward LIGHT — a translate is all it takes,
          // because the path is already built. One extra stroke per sprite
          // (~45/frame at the peak), no new interception, no filter.
          //   CLIPPED to the body, and that is not optional. The first cut simply
          // translated the stroke toward LIGHT, so it poked out past the ink on
          // the lit side and BRIGHTENED the contour — the silhouette guardrail
          // went red naming nine enemies (mudlet, knight, healer, brick, mole,
          // tinplane, racer, yarn, reject) whose boundary no longer read darker
          // than the lane. Clipping to the current path confines the highlight
          // strictly inside the shape, which is what a rim light is anyway, and
          // leaves the dark contour the ink line's alone.
          if (litOn) {
          const px = LIGHT.x * Math.max(0.6, cell * 0.040);
          const py = LIGHT.y * Math.max(0.6, cell * 0.040);
          const ps = ctx.strokeStyle, pw = ctx.lineWidth, pj = ctx.lineJoin, pc = ctx.lineCap;
          ctx.save();
          ctx.clip();                       // the body, in its own untranslated space
          ctx.translate(px, py);
          ctx.strokeStyle = LITEDGE; ctx.lineWidth = Math.max(1, cell * 0.040);
          ctx.lineJoin = "round"; ctx.lineCap = "round";
          busy = true; realStroke(); busy = false;
          ctx.restore();
          ctx.strokeStyle = ps; ctx.lineWidth = pw; ctx.lineJoin = pj; ctx.lineCap = pc;
          }
        }
        return out;
      };
      // A STROKE-ONLY sprite needs the ink too, and there are two: the Runaway
      // Clip is a hollow chrome wire with no fill anywhere, and the Battery Bot's
      // shell is likewise drawn as an outline. Measured at ringMinMed 186 and 191
      // against a rimmed roster at 24-68 — so a fill-only interception would have
      // shipped exactly two invisible enemies and called the law satisfied. Here
      // the dark pen goes UNDER (wider, first), so the bright wire keeps its
      // colour and gains a contour. Hairlines are skipped: inking a 1px detail
      // line just turns it to mud.
      ctx.stroke = function () {
        if (inkDepth > 0 && !inkOff && !busy && inkBudget > 0 && ctx.lineWidth >= cell * 0.04) {
          inkBudget--;
          pen(ctx.lineWidth + Math.max(1.6, cell * 0.06));
        }
        return realStroke();
      };
      return true;
    })();
    // `lit` opts a sprite into the highlight. It is OFF by default and that is a
    // measurement, not a preference: A/B at L24's 162-enemy peak reads 2.22 ms
    // baseline → 2.67 with the directional shadow → 4.49 with the lit edge on
    // everything. The extra 1.82 ms is almost entirely the per-sprite `clip()`,
    // which is the single worst thing to spend on a software rasteriser — and
    // Josh's iPad and CI's real WebKit both rasterize in software, so a Chromium
    // number here is an UNDER-estimate (the documented trap). Meanwhile a rim
    // light on a body a few pixels across is invisible: the enemies that make up
    // that 162 are the ones paying most and showing least. So the highlight goes
    // on the big, long-lived, deliberately-inspected things — towers and bosses —
    // and the swarm keeps the ink line alone.
    function withInk(fn, lit, flash) {
      if (!canInk) return fn();
      inkDepth++; inkBudget = INK_PER_SPRITE; litOn = !!lit; flashOn = flash || 0;
      try { return fn(); } finally { inkDepth--; inkBudget = 0; litOn = false; flashOn = 0; }
    }
    function noInk(fn) { if (!canInk) return fn(); inkOff++; try { return fn(); } finally { inkOff--; } }

    // ---------- enemies (upright, screen space) ----------
    // A boss must LOOK like one. The scale is a data field (`size`), so a new
    // boss is big by declaring it, not by hand-tuning a constant in here.
    function bossScale(e, fallback) {
      const def = global.TDData.ENEMIES[e.type];
      return (def && def.size) || fallback;
    }
    // 👑 THE boss mark, and there is exactly ONE of it. Four bosses hand-rolled
    // their own crown polygon and the other FOUR had none at all — including the
    // first boss you ever meet (the Bed Monster) and the campaign's last (the
    // Big Magnet). The fort home puts a 👑 on a boss finale and the guide gives
    // every boss a "its kit escalates" line, so the one place the player could
    // not tell a boss from a big enemy was the battlefield itself. Centralized
    // here, so a ninth boss inherits it — and a guardrail derived from
    // `DATA.ENEMIES` fails if any boss's draw branch does not call it.
    // `topY` is the top of the body, in screen px; the crown sits above it.
    function bossCrown(sx, topY, R) {
      const h = R * 0.3, w = R * 0.42;
      ctx.fillStyle = "#ffd94a";
      ctx.beginPath();
      ctx.moveTo(sx - w, topY);
      ctx.lineTo(sx - w, topY - h);
      ctx.lineTo(sx - w * 0.5, topY - h * 0.45);
      ctx.lineTo(sx, topY - h * 1.28);
      ctx.lineTo(sx + w * 0.5, topY - h * 0.45);
      ctx.lineTo(sx + w, topY - h);
      ctx.lineTo(sx + w, topY);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#c8392f";                                   // a jewel, so it reads at cell 27
      ctx.beginPath(); ctx.arc(sx, topY - h * 0.34, R * 0.07, 0, 7); ctx.fill();
    }
    // 🧨's reveal rider: a flushed-out hider must LOOK catchable, or the player
    // has no way to know the blast did anything (the picture is the mechanic —
    // the same lesson the side-door marker taught).
    function revealed(e) { return !!(engine.isRevealed && engine.isRevealed(e)); }
    function drawEnemy(e, sx, sy) {
      const r = cell * 0.34;
      if (revealed(e)) noInk(() => {
        const pulse = 0.25 + 0.15 * Math.sin(engine.state.tick / 4 + e.id);
        ctx.fillStyle = "rgba(255,214,120," + pulse.toFixed(2) + ")";
        ctx.beginPath(); ctx.arc(sx, sy, r * 1.5, 0, 7); ctx.fill();
      });
      if (e.type === "balloon") {
        // a floating balloon-bug: small ground shadow (it hovers), body, knot, string
        shadow(sx, sy + cell * 0.5, r * 0.6, r * 0.22);
        const by = sy - cell * 0.06;
        ctx.strokeStyle = "rgba(230,235,245,0.7)"; ctx.lineWidth = Math.max(1, cell * 0.03);
        ctx.beginPath(); ctx.moveTo(sx, by + r * 1.0);
        ctx.quadraticCurveTo(sx + r * 0.4, by + r * 1.5, sx, by + r * 1.9); ctx.stroke();
        const gg = ctx.createRadialGradient(sx - r * 0.35, by - r * 0.4, r * 0.1, sx, by, r * 1.15);
        gg.addColorStop(0, "#ff9aa9"); gg.addColorStop(1, "#e23b57");
        ctx.fillStyle = gg;
        ctx.beginPath(); ctx.ellipse(sx, by, r * 0.9, r * 1.08, 0, 0, 7); ctx.fill();
        ctx.fillStyle = "#e23b57";
        ctx.beginPath(); ctx.moveTo(sx - r * 0.16, by + r * 1.02); ctx.lineTo(sx + r * 0.16, by + r * 1.02); ctx.lineTo(sx, by + r * 1.28); ctx.closePath(); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.7)";
        ctx.beginPath(); ctx.ellipse(sx - r * 0.34, by - r * 0.36, r * 0.2, r * 0.3, -0.5, 0, 7); ctx.fill();
        // buggy eyes
        ctx.fillStyle = "#22304a";
        ctx.beginPath(); ctx.arc(sx - r * 0.28, by, r * 0.13, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.arc(sx + r * 0.28, by, r * 0.13, 0, 7); ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.beginPath(); ctx.arc(sx - r * 0.31, by - r * 0.04, r * 0.045, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.arc(sx + r * 0.25, by - r * 0.04, r * 0.045, 0, 7); ctx.fill();
      } else if (e.type === "marble") {
        // a glossy speed-marble with a cat's-eye swirl + specular pop
        shadow(sx, sy + cell * 0.28, r * 0.7, r * 0.26);
        const rr = r * 0.78;
        const gm = ctx.createRadialGradient(sx - rr * 0.35, sy - rr * 0.4, rr * 0.15, sx, sy, rr);
        gm.addColorStop(0, "#d6f0ff"); gm.addColorStop(0.55, "#5aa9e6"); gm.addColorStop(1, "#245b95");
        ctx.fillStyle = gm;
        ctx.beginPath(); ctx.arc(sx, sy, rr, 0, 7); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.85)"; // swirl lens
        ctx.beginPath(); ctx.ellipse(sx + rr * 0.1, sy, rr * 0.5, rr * 0.22, 0.5, 0, 7); ctx.fill();
        ctx.fillStyle = "#e86bd0";
        ctx.beginPath(); ctx.ellipse(sx + rr * 0.1, sy, rr * 0.34, rr * 0.13, 0.5, 0, 7); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.95)"; // specular
        ctx.beginPath(); ctx.arc(sx - rr * 0.38, sy - rr * 0.4, rr * 0.2, 0, 7); ctx.fill();
      // ---- Phase 2: the per-world backbone SKINS ----
      // Same body as the Sock Goblin (34hp trooper) or the Speedy Marble (16hp
      // sprinter), a different costume per world — so the Garage and Moving Day
      // stop being the same wave table in different level names. Each needs a
      // real branch: the chain ends in a default sock, and the ART guardrail
      // fails if any two enemy types hash the same, which is how a missing
      // branch announces itself.
      } else if (e.type === "acorn") {
        // 🌰 Acorn Trooper — a nut in a cap, marching with a stubby stem
        shadow(sx, sy + r * 0.55, r * 0.6, r * 0.18);
        const ga = ctx.createLinearGradient(sx, sy - r * 0.2, sx, sy + r * 0.6);
        ga.addColorStop(0, "#e6b678"); ga.addColorStop(1, "#b57a3c");
        ctx.fillStyle = ga;
        ctx.beginPath(); ctx.ellipse(sx, sy + r * 0.16, r * 0.6, r * 0.62, 0, 0, 7); ctx.fill();
        ctx.fillStyle = "#6b4423"; // cap
        ctx.beginPath(); ctx.ellipse(sx, sy - r * 0.3, r * 0.68, r * 0.36, 0, Math.PI, 0); ctx.fill();
        ctx.fillRect(sx - r * 0.68, sy - r * 0.32, r * 1.36, r * 0.12);
        ctx.strokeStyle = "#4d3018"; ctx.lineWidth = Math.max(1, cell * 0.035);
        ctx.beginPath(); ctx.moveTo(sx, sy - r * 0.6); ctx.lineTo(sx + r * 0.1, sy - r * 0.92); ctx.stroke(); // stem
        ctx.fillStyle = "#3a2412";
        ctx.beginPath(); ctx.arc(sx - r * 0.2, sy + r * 0.1, r * 0.09, 0, 7); ctx.arc(sx + r * 0.2, sy + r * 0.1, r * 0.09, 0, 7); ctx.fill();
        ctx.strokeStyle = "#3a2412"; ctx.lineWidth = Math.max(1, cell * 0.025);
        ctx.beginPath(); ctx.arc(sx, sy + r * 0.3, r * 0.18, 0.25, Math.PI - 0.25); ctx.stroke();
      } else if (e.type === "ant") {
        // 🐜 Ant Scout — three beads and skittering legs, so speed READS
        shadow(sx, sy + r * 0.4, r * 0.6, r * 0.14);
        const sk = Math.sin(engine.state.tick / 2 + e.id) * r * 0.12;
        ctx.strokeStyle = "#2b1b10"; ctx.lineWidth = Math.max(1, cell * 0.028);
        for (let k = -1; k <= 1; k++) {
          ctx.beginPath(); ctx.moveTo(sx + k * r * 0.22, sy); ctx.lineTo(sx + k * r * 0.22 - r * 0.3, sy + r * 0.42 + (k ? sk : -sk)); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(sx + k * r * 0.22, sy); ctx.lineTo(sx + k * r * 0.22 + r * 0.3, sy + r * 0.42 - (k ? sk : -sk)); ctx.stroke();
        }
        ctx.fillStyle = "#54331c";
        ctx.beginPath(); ctx.ellipse(sx + r * 0.42, sy, r * 0.34, r * 0.3, 0, 0, 7); ctx.fill(); // abdomen
        ctx.fillStyle = "#7a4a26";
        ctx.beginPath(); ctx.ellipse(sx, sy, r * 0.24, r * 0.22, 0, 0, 7); ctx.fill(); // thorax
        ctx.fillStyle = "#3d2413";
        ctx.beginPath(); ctx.ellipse(sx - r * 0.42, sy - r * 0.04, r * 0.28, r * 0.26, 0, 0, 7); ctx.fill(); // head
        ctx.strokeStyle = "#3d2413"; ctx.lineWidth = Math.max(1, cell * 0.022);
        ctx.beginPath(); ctx.moveTo(sx - r * 0.6, sy - r * 0.15); ctx.lineTo(sx - r * 0.85, sy - r * 0.5); ctx.moveTo(sx - r * 0.55, sy - r * 0.2); ctx.lineTo(sx - r * 0.68, sy - r * 0.58); ctx.stroke();
        ctx.fillStyle = "#ffe9c4";
        ctx.beginPath(); ctx.arc(sx - r * 0.5, sy - r * 0.06, r * 0.07, 0, 7); ctx.fill();
      } else if (e.type === "yoyo") {
        // 🪀 Yo-Yo Bandit — two discs on an axle, hanging off its own string
        ctx.strokeStyle = "rgba(240,240,250,0.75)"; ctx.lineWidth = Math.max(1, cell * 0.03);
        ctx.beginPath(); ctx.moveTo(sx, sy - r * 1.05); ctx.lineTo(sx, sy - r * 0.15); ctx.stroke();
        shadow(sx, sy + r * 0.7, r * 0.6, r * 0.18);
        const spin = (engine.state.tick / 4 + e.id) % 6.283;
        const gy = ctx.createRadialGradient(sx - r * 0.25, sy - r * 0.2, r * 0.1, sx, sy + r * 0.1, r * 0.8);
        gy.addColorStop(0, "#ff9e6b"); gy.addColorStop(1, "#c8412a");
        ctx.fillStyle = gy;
        ctx.beginPath(); ctx.arc(sx, sy + r * 0.1, r * 0.7, 0, 7); ctx.fill();
        ctx.strokeStyle = "#7d2415"; ctx.lineWidth = Math.max(1, cell * 0.04);
        ctx.beginPath(); ctx.arc(sx, sy + r * 0.1, r * 0.7, 0, 7); ctx.stroke();
        ctx.strokeStyle = "rgba(255,240,220,0.85)"; ctx.lineWidth = Math.max(1, cell * 0.03);
        for (let k = 0; k < 3; k++) { // spokes make the spin visible
          const a = spin + k * 2.094;
          ctx.beginPath(); ctx.moveTo(sx, sy + r * 0.1); ctx.lineTo(sx + Math.cos(a) * r * 0.55, sy + r * 0.1 + Math.sin(a) * r * 0.55); ctx.stroke();
        }
        ctx.fillStyle = "#ffe6c8";
        ctx.beginPath(); ctx.arc(sx, sy + r * 0.1, r * 0.16, 0, 7); ctx.fill();
      } else if (e.type === "die") {
        // 🎲 Runaway Die — a tumbling white cube; the pip face rolls as it moves
        shadow(sx, sy + r * 0.55, r * 0.6, r * 0.16);
        const face = 1 + (Math.floor(e.dist * 1.5) % 6);
        ctx.save();
        ctx.translate(sx, sy); ctx.rotate(Math.sin(e.dist * 0.9 + e.id) * 0.35);
        const gd = ctx.createLinearGradient(0, -r * 0.6, 0, r * 0.6);
        gd.addColorStop(0, "#ffffff"); gd.addColorStop(1, "#cfd6e2");
        ctx.fillStyle = gd; ctx.beginPath(); ctx.rect(-r * 0.58, -r * 0.58, r * 1.16, r * 1.16); ctx.fill();
        // Its own outline was #8d97a8 (luma ~150) drawn via strokeRect, which
        // bypasses the path — so it painted a PALE line straight over the ink and
        // left the die the one sprite in the roster with no dark contour (measured
        // 115 against a lane of 140). Repointed dark; the pips supply the detail.
        ctx.strokeStyle = "rgba(40,48,63,0.9)"; ctx.lineWidth = Math.max(1, cell * 0.04);
        ctx.strokeRect(-r * 0.58, -r * 0.58, r * 1.16, r * 1.16);
        ctx.fillStyle = "#28303f";
        const pip = (px, py) => { ctx.beginPath(); ctx.arc(px * r * 0.32, py * r * 0.32, r * 0.11, 0, 7); ctx.fill(); };
        if (face % 2) pip(0, 0);
        if (face > 1) { pip(-1, -1); pip(1, 1); }
        if (face > 3) { pip(-1, 1); pip(1, -1); }
        if (face === 6) { pip(-1, 0); pip(1, 0); }
        ctx.restore();
      } else if (e.type === "mitten") {
        // 🧤 Lost Mitten — a knitted mitten with a cuff and a dangling thread
        shadow(sx, sy + r * 0.6, r * 0.55, r * 0.16);
        const gmi = ctx.createLinearGradient(sx, sy - r * 0.6, sx, sy + r * 0.6);
        gmi.addColorStop(0, "#e0567a"); gmi.addColorStop(1, "#9c2f4d");
        ctx.fillStyle = gmi;
        ctx.beginPath();
        ctx.moveTo(sx - r * 0.42, sy + r * 0.55); ctx.lineTo(sx - r * 0.42, sy - r * 0.2);
        ctx.quadraticCurveTo(sx - r * 0.42, sy - r * 0.72, sx + r * 0.06, sy - r * 0.72);
        ctx.quadraticCurveTo(sx + r * 0.5, sy - r * 0.72, sx + r * 0.5, sy - r * 0.2);
        ctx.lineTo(sx + r * 0.5, sy + r * 0.55); ctx.closePath(); ctx.fill();
        ctx.fillStyle = "#c14264"; // thumb
        ctx.beginPath(); ctx.ellipse(sx + r * 0.6, sy - r * 0.02, r * 0.18, r * 0.3, -0.3, 0, 7); ctx.fill();
        ctx.fillStyle = "#f4e3d0"; // cuff
        ctx.beginPath(); ctx.rect(sx - r * 0.5, sy + r * 0.4, r * 1.1, r * 0.28); ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.4)"; ctx.lineWidth = Math.max(1, cell * 0.022);
        for (let k = -1; k <= 1; k++) { ctx.beginPath(); ctx.moveTo(sx + k * r * 0.24, sy - r * 0.6); ctx.lineTo(sx + k * r * 0.24, sy + r * 0.36); ctx.stroke(); }
        ctx.strokeStyle = "#f4e3d0"; ctx.lineWidth = Math.max(1, cell * 0.02); // loose thread
        ctx.beginPath(); ctx.moveTo(sx - r * 0.5, sy + r * 0.54);
        ctx.quadraticCurveTo(sx - r * 0.9, sy + r * 0.4, sx - r * 0.8, sy + r * 0.75); ctx.stroke();
        ctx.fillStyle = "#3a2030";
        ctx.beginPath(); ctx.arc(sx - r * 0.12, sy - r * 0.16, r * 0.08, 0, 7); ctx.arc(sx + r * 0.2, sy - r * 0.16, r * 0.08, 0, 7); ctx.fill();
      } else if (e.type === "yarn") {
        // 🧶 Yarn Ball — a wound ball trailing its own strand, rolling
        shadow(sx, sy + r * 0.4, r * 0.62, r * 0.2);
        const rr = r * 0.72, roll = e.dist * 1.4 + e.id;
        const gyn = ctx.createRadialGradient(sx - rr * 0.35, sy - rr * 0.4, rr * 0.12, sx, sy, rr);
        gyn.addColorStop(0, "#b9e6c8"); gyn.addColorStop(1, "#3f8f66");
        ctx.fillStyle = gyn; ctx.beginPath(); ctx.arc(sx, sy, rr, 0, 7); ctx.fill();
        ctx.save();
        ctx.beginPath(); ctx.arc(sx, sy, rr, 0, 7); ctx.clip();
        ctx.strokeStyle = "rgba(20,70,50,0.5)"; ctx.lineWidth = Math.max(1, cell * 0.03);
        for (let k = -2; k <= 2; k++) {
          ctx.beginPath();
          ctx.ellipse(sx, sy, rr * 0.95, rr * 0.34, roll * 0.3 + k * 0.6, 0, 7);
          ctx.stroke();
        }
        ctx.restore();
        ctx.strokeStyle = "#3f8f66"; ctx.lineWidth = Math.max(1, cell * 0.028); // trailing strand
        ctx.beginPath(); ctx.moveTo(sx - rr * 0.9, sy + rr * 0.3);
        ctx.quadraticCurveTo(sx - rr * 1.6, sy + rr * 0.1, sx - rr * 1.5, sy + rr * 0.8); ctx.stroke();
      } else if (e.type === "rag") {
        // 🧽 Grease Rag — a slumped oily cloth with drips
        shadow(sx, sy + r * 0.5, r * 0.7, r * 0.18);
        const gg2 = ctx.createLinearGradient(sx, sy - r * 0.5, sx, sy + r * 0.5);
        gg2.addColorStop(0, "#cf9a7e"); gg2.addColorStop(1, "#7a4634");
        ctx.fillStyle = gg2;
        ctx.beginPath();
        ctx.moveTo(sx - r * 0.75, sy + r * 0.4);
        ctx.quadraticCurveTo(sx - r * 0.85, sy - r * 0.35, sx - r * 0.25, sy - r * 0.5);
        ctx.quadraticCurveTo(sx + r * 0.3, sy - r * 0.68, sx + r * 0.7, sy - r * 0.25);
        ctx.quadraticCurveTo(sx + r * 0.92, sy + r * 0.2, sx + r * 0.5, sy + r * 0.44);
        ctx.quadraticCurveTo(sx, sy + r * 0.24, sx - r * 0.75, sy + r * 0.4);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = "rgba(24,22,18,0.65)"; // grease patches
        ctx.beginPath(); ctx.ellipse(sx - r * 0.2, sy - r * 0.05, r * 0.26, r * 0.17, 0.4, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.ellipse(sx + r * 0.36, sy + r * 0.1, r * 0.16, r * 0.11, -0.3, 0, 7); ctx.fill();
        ctx.fillStyle = "#1b1a16"; // a drip below
        ctx.beginPath(); ctx.ellipse(sx + r * 0.1, sy + r * 0.62, r * 0.08, r * 0.14, 0, 0, 7); ctx.fill();
        ctx.fillStyle = "#f0f3f8";
        ctx.beginPath(); ctx.arc(sx - r * 0.22, sy - r * 0.22, r * 0.1, 0, 7); ctx.arc(sx + r * 0.16, sy - r * 0.26, r * 0.1, 0, 7); ctx.fill();
        ctx.fillStyle = "#20242c";
        ctx.beginPath(); ctx.arc(sx - r * 0.2, sy - r * 0.2, r * 0.05, 0, 7); ctx.arc(sx + r * 0.18, sy - r * 0.24, r * 0.05, 0, 7); ctx.fill();
      } else if (e.type === "cog") {
        // ⚙️ Rogue Cog — a toothed steel gear that spins as it rolls
        shadow(sx, sy + r * 0.45, r * 0.6, r * 0.16);
        const rr2 = r * 0.66, spin2 = e.dist * 1.1 + e.id;
        ctx.save(); ctx.translate(sx, sy); ctx.rotate(spin2);
        const gc = ctx.createRadialGradient(-rr2 * 0.3, -rr2 * 0.3, rr2 * 0.1, 0, 0, rr2);
        gc.addColorStop(0, "#dfe6f0"); gc.addColorStop(1, "#7c879a");
        ctx.fillStyle = gc;
        ctx.beginPath();
        for (let k = 0; k < 8; k++) {
          const a0 = (k / 8) * 6.283, a1 = a0 + 0.28, a2 = a0 + 0.505;
          ctx.lineTo(Math.cos(a0) * rr2, Math.sin(a0) * rr2);
          ctx.lineTo(Math.cos(a0 + 0.14) * rr2 * 1.32, Math.sin(a0 + 0.14) * rr2 * 1.32);
          ctx.lineTo(Math.cos(a1) * rr2 * 1.32, Math.sin(a1) * rr2 * 1.32);
          ctx.lineTo(Math.cos(a2) * rr2, Math.sin(a2) * rr2);
        }
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = "#4d5765"; ctx.lineWidth = Math.max(1, cell * 0.03); ctx.stroke();
        ctx.fillStyle = "#2f3743"; ctx.beginPath(); ctx.arc(0, 0, rr2 * 0.34, 0, 7); ctx.fill();
        ctx.restore();
      } else if (e.type === "wad") {
        // 🗞️ Packing Wad — a crumpled ball of newsprint with creases + print
        shadow(sx, sy + r * 0.5, r * 0.6, r * 0.17);
        ctx.fillStyle = "#eee7d6";
        ctx.beginPath();
        const lobes = 9;
        for (let k = 0; k <= lobes; k++) {
          const a = (k / lobes) * 6.283;
          const rad = r * (0.62 + 0.16 * Math.sin(k * 2.3 + e.id));
          ctx.lineTo(sx + Math.cos(a) * rad, sy + Math.sin(a) * rad);
        }
        ctx.closePath(); ctx.fill();
        // a dark rim so a pale body still reads against the sand-coloured lane
        ctx.strokeStyle = "rgba(92,78,54,0.95)"; ctx.lineWidth = Math.max(1.5, cell * 0.05); ctx.stroke();
        ctx.strokeStyle = "#b9ad93"; ctx.lineWidth = Math.max(1, cell * 0.025);
        ctx.beginPath();
        ctx.moveTo(sx - r * 0.5, sy - r * 0.2); ctx.lineTo(sx - r * 0.05, sy + r * 0.06); ctx.lineTo(sx + r * 0.45, sy - r * 0.3);
        ctx.moveTo(sx - r * 0.25, sy + r * 0.45); ctx.lineTo(sx + r * 0.05, sy + r * 0.05); ctx.lineTo(sx + r * 0.4, sy + r * 0.4);
        ctx.stroke();
        ctx.fillStyle = "rgba(90,84,72,0.55)"; // scraps of print
        for (let k = 0; k < 3; k++) ctx.fillRect(sx - r * 0.34 + k * r * 0.06, sy - r * 0.46 + k * r * 0.3, r * 0.4, r * 0.06);
        ctx.fillStyle = "#4a4438";
        ctx.beginPath(); ctx.arc(sx - r * 0.18, sy - r * 0.06, r * 0.07, 0, 7); ctx.arc(sx + r * 0.18, sy - r * 0.06, r * 0.07, 0, 7); ctx.fill();
      } else if (e.type === "peanut") {
        // 🥜 Packing Peanut — a pale foam S-curve, bouncing along
        const bob = Math.sin(engine.state.tick / 4 + e.id) * r * 0.12;
        shadow(sx, sy + r * 0.5, r * 0.45, r * 0.13);
        ctx.save(); ctx.translate(sx, sy + bob); ctx.rotate(-0.5);
        const gp = ctx.createLinearGradient(-r * 0.4, -r * 0.4, r * 0.4, r * 0.4);
        gp.addColorStop(0, "#fdfaf0"); gp.addColorStop(1, "#ddd4bd");
        ctx.fillStyle = gp;
        ctx.strokeStyle = "rgba(96,84,58,0.95)"; ctx.lineWidth = Math.max(1.5, cell * 0.05);
        // one closed S-shape, filled AND stroked: the first cut drew three
        // overlapping pale shapes with no rim and the swarm vanished on the lane
        ctx.beginPath();
        ctx.ellipse(-r * 0.3, -r * 0.22, r * 0.3, r * 0.26, 0, 0, 7); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(r * 0.3, r * 0.22, r * 0.3, r * 0.26, 0, 0, 7); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.rect(-r * 0.3, -r * 0.24, r * 0.6, r * 0.48); ctx.fill();
        ctx.strokeStyle = "rgba(160,150,125,0.7)"; ctx.lineWidth = Math.max(1, cell * 0.022);
        ctx.beginPath(); ctx.moveTo(-r * 0.42, -r * 0.02); ctx.lineTo(r * 0.42, -r * 0.02); ctx.stroke();
        ctx.restore();
        ctx.fillStyle = "#6a6252";
        ctx.beginPath(); ctx.arc(sx - r * 0.16, sy + bob - r * 0.08, r * 0.06, 0, 7); ctx.arc(sx + r * 0.06, sy + bob - r * 0.2, r * 0.06, 0, 7); ctx.fill();
      } else if (e.type === "carton") {
        // 🧃 Juice Carton — a squat gable-top drink carton, sun-faded, listing
        shadow(sx, sy + r * 0.6, r * 0.58, r * 0.16);
        ctx.save(); ctx.translate(sx, sy); ctx.rotate(Math.sin(engine.state.tick / 6 + e.id) * 0.1);
        const gca = ctx.createLinearGradient(0, -r * 0.6, 0, r * 0.6);
        gca.addColorStop(0, "#e8a45c"); gca.addColorStop(1, "#b3702e");
        ctx.fillStyle = gca;
        ctx.beginPath(); ctx.rect(-r * 0.46, -r * 0.3, r * 0.92, r * 0.9); ctx.fill();
        ctx.fillStyle = "#cfd6dd";                                        // crimped foil gable
        ctx.beginPath(); ctx.moveTo(-r * 0.46, -r * 0.3); ctx.lineTo(0, -r * 0.72); ctx.lineTo(r * 0.46, -r * 0.3); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = "rgba(70,45,20,0.9)"; ctx.lineWidth = Math.max(1.5, cell * 0.05);
        ctx.beginPath(); ctx.rect(-r * 0.46, -r * 0.3, r * 0.92, r * 0.9); ctx.stroke();
        ctx.strokeStyle = "rgba(70,45,20,0.5)"; ctx.lineWidth = Math.max(1, cell * 0.03);
        ctx.beginPath(); ctx.moveTo(0, -r * 0.3); ctx.lineTo(0, r * 0.6); ctx.stroke();
        ctx.fillStyle = "#f2f6fa";                                        // bent straw
        ctx.beginPath(); ctx.rect(r * 0.1, -r * 0.95, r * 0.09, r * 0.36); ctx.fill();
        ctx.fillStyle = "#3a2712";
        ctx.beginPath(); ctx.arc(-r * 0.18, r * 0.16, r * 0.08, 0, 7); ctx.arc(r * 0.18, r * 0.16, r * 0.08, 0, 7); ctx.fill();
        ctx.restore();
      } else if (e.type === "clip") {
        // 📎 Runaway Clip — HOLLOW chrome wire, tumbling. Deliberately not the
        // Rogue Cog's filled toothed disc: two nested outlines, no fill, no face.
        shadow(sx, sy + r * 0.45, r * 0.5, r * 0.13);
        ctx.save(); ctx.translate(sx, sy); ctx.rotate(engine.state.tick * 0.12 + e.id);
        const gcl = ctx.createLinearGradient(-r * 0.5, -r * 0.5, r * 0.5, r * 0.5);
        gcl.addColorStop(0, "#dff05a"); gcl.addColorStop(1, "#8fa314");
        ctx.strokeStyle = gcl; ctx.lineWidth = Math.max(1.5, cell * 0.055);
        const rr = (w, h) => { ctx.beginPath(); ctx.moveTo(-w, -h + r * 0.1); ctx.quadraticCurveTo(-w, -h, -w + r * 0.1, -h); ctx.lineTo(w - r * 0.1, -h); ctx.quadraticCurveTo(w, -h, w, -h + r * 0.1); ctx.lineTo(w, h - r * 0.1); ctx.quadraticCurveTo(w, h, w - r * 0.1, h); ctx.stroke(); };
        rr(r * 0.24, r * 0.6); rr(r * 0.12, r * 0.44);
        ctx.strokeStyle = "rgba(255,255,255,0.85)"; ctx.lineWidth = Math.max(1, cell * 0.03);
        ctx.beginPath(); ctx.moveTo(-r * 0.2, -r * 0.4); ctx.lineTo(-r * 0.2, r * 0.1); ctx.stroke();
        ctx.restore();
      } else if (e.type === "leaflet") {
        // 📄 Loose Leaf — the campaign's first EXCLUSIVE flier. A sheet at an
        // angle with a folded corner; the shadow sits well BELOW so the gap
        // reads as air, the way every flier here does.
        shadow(sx, sy + cell * 0.55, r * 0.5, r * 0.18);
        const flut = Math.sin(engine.state.tick / 3 + e.id) * 0.18;
        ctx.save(); ctx.translate(sx, sy - cell * 0.06); ctx.transform(1, flut, 0, 1, 0, 0);
        ctx.fillStyle = "#f6f4ee";
        ctx.beginPath(); ctx.moveTo(-r * 0.52, -r * 0.62); ctx.lineTo(r * 0.44, -r * 0.52); ctx.lineTo(r * 0.52, r * 0.62); ctx.lineTo(-r * 0.44, r * 0.52); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = "rgba(90,88,78,0.9)"; ctx.lineWidth = Math.max(1.2, cell * 0.035); ctx.stroke();
        ctx.fillStyle = "#d8d4c6";                                        // folded corner
        ctx.beginPath(); ctx.moveTo(r * 0.44, -r * 0.52); ctx.lineTo(r * 0.14, -r * 0.46); ctx.lineTo(r * 0.48, -r * 0.14); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = "rgba(120,118,108,0.6)"; ctx.lineWidth = Math.max(1, cell * 0.022);
        for (let k = 0; k < 3; k++) { const y = -r * 0.12 + k * r * 0.24; ctx.beginPath(); ctx.moveTo(-r * 0.34, y); ctx.lineTo(r * 0.32, y); ctx.stroke(); }
        ctx.fillStyle = "#4a4840";
        ctx.beginPath(); ctx.arc(-r * 0.2, -r * 0.34, r * 0.07, 0, 7); ctx.arc(r * 0.06, -r * 0.31, r * 0.07, 0, 7); ctx.fill();
        ctx.restore();
      } else if (e.type === "reject") {
        // 🧩 Reject Piece — a jigsaw tab that came off the mould misshapen. Drawn
        // TALL and narrow with a bold sunken socket and a bright top face: the
        // near-twin metric is driven by silhouette and coverage as much as hue
        // (the shipped roster's closest pairs sit at 1.52-1.67 against a 1.2
        // floor), and a wide low blob reads as the Grease Rag no matter what
        // colour it is. Measured, not eyeballed.
        shadow(sx, sy + r * 0.62, r * 0.44, r * 0.16);
        const gj = ctx.createLinearGradient(0, sy - r * 0.72, 0, sy + r * 0.62);
        gj.addColorStop(0, "#f57ac0"); gj.addColorStop(1, "#8e1a63");
        ctx.fillStyle = gj;
        ctx.beginPath(); ctx.rect(sx - r * 0.34, sy - r * 0.72, r * 0.68, r * 1.34); ctx.fill();
        ctx.beginPath(); ctx.arc(sx + r * 0.36, sy - r * 0.3, r * 0.22, 0, 7); ctx.fill();   // knob
        ctx.fillStyle = "#ffb3d9";                                                            // bright top face
        ctx.beginPath(); ctx.rect(sx - r * 0.34, sy - r * 0.72, r * 0.68, r * 0.2); ctx.fill();
        ctx.fillStyle = "#1d0f18";                                                            // deep socket
        ctx.beginPath(); ctx.arc(sx - r * 0.36, sy + r * 0.14, r * 0.24, 0, 7); ctx.fill();
        ctx.fillStyle = "#33202b";
        ctx.beginPath(); ctx.arc(sx - r * 0.1, sy - r * 0.3, r * 0.07, 0, 7); ctx.arc(sx + r * 0.12, sy - r * 0.3, r * 0.07, 0, 7); ctx.fill();
      } else if (e.type === "pellet") {
        // 🟠 Resin Pellet — what the line is FED. A fat, nearly-round bead with a
        // hard dark seam right across it, so its coverage and internal contrast
        // are unlike the Spare Key's thin silhouette (they measured 1.13 apart
        // against a 1.2 floor when it was a small pale lozenge).
        shadow(sx, sy + r * 0.5, r * 0.46, r * 0.16);
        const gp = ctx.createRadialGradient(sx - r * 0.16, sy - r * 0.18, r * 0.05, sx, sy, r * 0.52);
        gp.addColorStop(0, "#fffdf6"); gp.addColorStop(1, "#b8ad8b");
        ctx.fillStyle = gp;
        ctx.beginPath(); ctx.arc(sx, sy, r * 0.5, 0, 7); ctx.fill();
        ctx.fillStyle = "#5d5442";                                          // the mould seam
        ctx.beginPath(); ctx.rect(sx - r * 0.5, sy - r * 0.07, r * 1.0, r * 0.14); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.85)";
        ctx.beginPath(); ctx.ellipse(sx - r * 0.18, sy - r * 0.26, r * 0.14, r * 0.08, -0.5, 0, 7); ctx.fill();
      } else if (e.type === "offcut") {
        // 🥏 Flying Offcut — a disc of trimmed sprue flung off the line, spinning
        // edge-on. Shadow sits well BELOW, like every flier here, and the disc
        // tilts as it turns so it reads as spinning rather than sliding.
        shadow(sx, sy + cell * 0.55, r * 0.44, r * 0.16);
        const spin = (engine.state.tick / 4 + e.id) % 6.283;
        ctx.save(); ctx.translate(sx, sy - cell * 0.06); ctx.rotate(spin);
        const gd = ctx.createLinearGradient(-r * 0.5, 0, r * 0.5, 0);
        gd.addColorStop(0, "#a8e024"); gd.addColorStop(1, "#6b9412");
        ctx.fillStyle = gd;
        ctx.beginPath(); ctx.ellipse(0, 0, r * 0.5, r * 0.2 + r * 0.24 * Math.abs(Math.cos(spin)), 0, 0, 7); ctx.fill();
        ctx.strokeStyle = "rgba(46,60,10,0.85)"; ctx.lineWidth = Math.max(1.2, cell * 0.03); ctx.stroke();
        ctx.restore();
      } else if (e.type === "stamper") {
        // 🗜️ The Stamping Press — the campaign's last boss. Drawn as a SOLID
        // machine rather than an open gantry: the boss-size guardrail counts INK
        // PIXELS, and a frame of thin bars paints less than an ordinary toy no
        // matter how wide it is (the first cut measured 260px against a grunt's
        // 434). Its RAM rides down as the phases escalate, so the fight is
        // readable on the machine itself — the Tickmaster's precedent.
        // A boss draws at BOSS scale. Omitting this is why the first cut painted
        // 312 ink pixels against an ordinary toy's 434: `r` is the grunt
        // radius, and `bossScale` is the ONE place `size` becomes pixels.
        const R = r * bossScale(e, 3.4);
        const ph = e.hp / e.maxHp;
        const drop = ph > 0.66 ? 0 : ph > 0.33 ? R * 0.18 : R * 0.34;
        shadow(sx, sy + R * 0.74, R * 0.86, R * 0.26);
        const gs = ctx.createLinearGradient(sx - R * 0.8, 0, sx + R * 0.8, 0);
        gs.addColorStop(0, "#3f4650"); gs.addColorStop(0.45, "#79828f"); gs.addColorStop(1, "#333a43");
        ctx.fillStyle = gs;                                               // the housing
        ctx.beginPath(); ctx.rect(sx - R * 0.8, sy - R * 0.86, R * 1.6, R * 1.6); ctx.fill();
        ctx.fillStyle = "#242a31";                                        // the throat the ram rides in
        ctx.beginPath(); ctx.rect(sx - R * 0.52, sy - R * 0.4, R * 1.04, R * 0.86); ctx.fill();
        ctx.fillStyle = "#9aa4b1";                                        // the RAM
        ctx.beginPath(); ctx.rect(sx - R * 0.46, sy - R * 0.36 + drop, R * 0.92, R * 0.5); ctx.fill();
        ctx.fillStyle = ph > 0.33 ? "#4a525c" : "#f2622a";                // the die, red-hot in P3
        ctx.beginPath(); ctx.rect(sx - R * 0.4, sy + R * 0.1 + drop, R * 0.8, R * 0.18); ctx.fill();
        ctx.fillStyle = "#1b2027";                                        // bed
        ctx.beginPath(); ctx.rect(sx - R * 0.72, sy + R * 0.5, R * 1.44, R * 0.24); ctx.fill();
        ctx.fillStyle = "#ffd94a";                                        // hazard band on the crown
        ctx.beginPath(); ctx.rect(sx - R * 0.8, sy - R * 0.86, R * 1.6, R * 0.16); ctx.fill();
        ctx.fillStyle = "#2a2f36";
        for (let k = -3; k <= 3; k++) { ctx.beginPath(); ctx.rect(sx + k * R * 0.22 - R * 0.05, sy - R * 0.86, R * 0.1, R * 0.16); ctx.fill(); }
        bossCrown(sx, sy - R * 0.86, R);
      } else if (e.type === "bigmagnet") {
        // 🧲 The Big Magnet — a gantry electromagnet on hazard-striped beams.
        // The DEBRIS clinging to the pole faces counts the phase (2 / 5 / 9) and
        // the halo goes white-hot in P3, the Tickmaster's precedent — so the
        // phase is readable on the boss itself, not only in the numbers.
        const R = r * bossScale(e, 3.2);
        const ph = e.hp / e.maxHp;
        const scraps = ph < 0.33 ? 9 : ph < 0.66 ? 5 : 2;
        shadow(sx, sy + R * 0.55, R * 0.68, R * 0.2);
        ctx.strokeStyle = "#6d7787"; ctx.lineWidth = Math.max(2, cell * 0.05);   // cables
        ctx.beginPath(); ctx.moveTo(sx - R * 0.34, sy - R * 0.9); ctx.lineTo(sx - R * 0.34, sy - R * 0.42);
        ctx.moveTo(sx + R * 0.34, sy - R * 0.9); ctx.lineTo(sx + R * 0.34, sy - R * 0.42); ctx.stroke();
        ctx.fillStyle = "#2a2d33";                                              // hazard crossbeam
        ctx.beginPath(); ctx.rect(sx - R * 0.62, sy - R * 1.0, R * 1.24, R * 0.2); ctx.fill();
        ctx.fillStyle = "#f2c53d";
        for (let k = 0; k < 5; k++) ctx.fillRect(sx - R * 0.58 + k * R * 0.25, sy - R * 0.98, R * 0.11, R * 0.16);
        const halo = ph < 0.33 ? "rgba(255,255,255," : "rgba(120,200,255,";      // charge halo
        for (let k = 1; k <= 3; k++) {
          const a = (0.24 - k * 0.05) * (0.6 + 0.4 * Math.sin(engine.state.tick / 7 + k));
          ctx.strokeStyle = halo + Math.max(0.02, a).toFixed(2) + ")"; ctx.lineWidth = Math.max(1.5, cell * 0.05);
          ctx.beginPath(); ctx.arc(sx, sy + R * 0.1, R * (0.5 + k * 0.16), 0.15, Math.PI - 0.15); ctx.stroke();
        }
        ctx.fillStyle = "#c0392b";                                              // horseshoe body
        ctx.beginPath();
        ctx.arc(sx, sy - R * 0.1, R * 0.5, Math.PI, 0); ctx.lineTo(sx + R * 0.5, sy + R * 0.16);
        ctx.lineTo(sx + R * 0.28, sy + R * 0.16); ctx.lineTo(sx + R * 0.28, sy - R * 0.1);
        ctx.arc(sx, sy - R * 0.1, R * 0.28, 0, Math.PI, true); ctx.lineTo(sx - R * 0.5, sy + R * 0.16);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = "#8fa6c4";                                              // pole faces
        ctx.fillRect(sx - R * 0.5, sy + R * 0.14, R * 0.22, R * 0.16);
        ctx.fillRect(sx + R * 0.28, sy + R * 0.14, R * 0.22, R * 0.16);
        ctx.fillStyle = "#5d666f";                                              // clinging debris
        for (let k = 0; k < scraps; k++) {
          const side = k % 2 ? 1 : -1, i = Math.floor(k / 2);
          ctx.beginPath();
          ctx.rect(sx + side * R * 0.39 - R * 0.06 + (i % 2) * R * 0.05, sy + R * 0.3 + i * R * 0.09, R * 0.12, R * 0.07);
          ctx.fill();
        }
        bossCrown(sx, sy - R * 0.62, R);   // the campaign FINALE had no boss mark either
      } else if (e.type === "chair") {
        // 🪑 Flat-Pack Chair — a half-assembled flat-pack seat, one leg still
        // loose, marching in on the other three (World 7's sock body)
        shadow(sx, sy + r * 0.6, r * 0.62, r * 0.18);
        const gch = ctx.createLinearGradient(sx, sy - r * 0.7, sx, sy + r * 0.5);
        gch.addColorStop(0, "#d6b98c"); gch.addColorStop(1, "#9c7b4e");
        ctx.fillStyle = gch;
        ctx.beginPath(); ctx.rect(sx - r * 0.5, sy - r * 0.75, r * 1.0, r * 0.6); ctx.fill();   // back
        ctx.beginPath(); ctx.rect(sx - r * 0.6, sy - r * 0.16, r * 1.2, r * 0.26); ctx.fill();  // seat
        ctx.strokeStyle = "#6d5433"; ctx.lineWidth = Math.max(1, cell * 0.05);
        ctx.strokeRect(sx - r * 0.5, sy - r * 0.75, r * 1.0, r * 0.6);
        ctx.beginPath();                                                                        // legs, one askew
        ctx.moveTo(sx - r * 0.46, sy + r * 0.1); ctx.lineTo(sx - r * 0.52, sy + r * 0.62);
        ctx.moveTo(sx + r * 0.46, sy + r * 0.1); ctx.lineTo(sx + r * 0.52, sy + r * 0.62);
        ctx.moveTo(sx + r * 0.1, sy + r * 0.1); ctx.lineTo(sx + r * 0.36, sy + r * 0.55);
        ctx.stroke();
        ctx.fillStyle = "#4a3a22";                                                              // dowel holes = eyes
        ctx.beginPath(); ctx.arc(sx - r * 0.2, sy - r * 0.5, r * 0.09, 0, 7); ctx.arc(sx + r * 0.2, sy - r * 0.5, r * 0.09, 0, 7); ctx.fill();
      } else if (e.type === "housekey") {
        // 🔑 Spare Key — a brass key skittering along on its teeth
        shadow(sx, sy + r * 0.42, r * 0.55, r * 0.14);
        ctx.save(); ctx.translate(sx, sy); ctx.rotate(Math.sin(e.dist * 1.1 + e.id) * 0.3);
        const gk = ctx.createLinearGradient(-r * 0.6, 0, r * 0.6, 0);
        gk.addColorStop(0, "#f2d98a"); gk.addColorStop(1, "#b58f3c");
        ctx.fillStyle = gk;
        ctx.beginPath(); ctx.arc(-r * 0.42, 0, r * 0.34, 0, 7); ctx.fill();     // bow
        ctx.beginPath(); ctx.rect(-r * 0.2, -r * 0.1, r * 0.86, r * 0.2); ctx.fill(); // shaft
        ctx.beginPath();                                                        // teeth
        ctx.rect(r * 0.34, r * 0.08, r * 0.12, r * 0.2);
        ctx.rect(r * 0.56, r * 0.08, r * 0.1, r * 0.26); ctx.fill();
        ctx.strokeStyle = "#7d6027"; ctx.lineWidth = Math.max(1, cell * 0.035);
        ctx.beginPath(); ctx.arc(-r * 0.42, 0, r * 0.34, 0, 7); ctx.stroke();
        ctx.fillStyle = "#5b4a1e";
        ctx.beginPath(); ctx.arc(-r * 0.42, 0, r * 0.14, 0, 7); ctx.fill();     // bow hole
        ctx.restore();
      } else if (e.type === "housedog") {
        // 🐕 The Housedog — World 7's finale: a big scruffy family dog with a
        // chewed toy in its jaws and ears that flatten as its phases escalate
        const R = r * bossScale(e, 3.0);
        const ph = e.hp / e.maxHp;
        shadow(sx, sy + R * 0.5, R * 0.72, R * 0.2);
        const gd = ctx.createLinearGradient(sx, sy - R * 0.5, sx, sy + R * 0.45);
        gd.addColorStop(0, "#c99a5e"); gd.addColorStop(1, "#8c6437");
        ctx.fillStyle = gd;
        ctx.beginPath(); ctx.ellipse(sx + R * 0.12, sy + R * 0.08, R * 0.62, R * 0.42, 0, 0, 7); ctx.fill(); // body
        ctx.beginPath(); ctx.ellipse(sx - R * 0.44, sy - R * 0.12, R * 0.36, R * 0.32, 0, 0, 7); ctx.fill(); // head
        ctx.fillStyle = "#6f4c26";                                                    // ears flatten with rage
        const ear = ph < 0.33 ? 0.18 : ph < 0.66 ? 0.3 : 0.42;
        ctx.beginPath(); ctx.ellipse(sx - r * 0.9, sy - R * (0.18 + ear * 0.4), R * 0.16, R * ear, -0.4, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.ellipse(sx - r * 0.1, sy - R * (0.2 + ear * 0.4), R * 0.15, R * ear, 0.3, 0, 7); ctx.fill();
        ctx.fillStyle = "#f4e6cf";                                                    // muzzle
        ctx.beginPath(); ctx.ellipse(sx - R * 0.66, sy - R * 0.02, R * 0.22, R * 0.17, 0, 0, 7); ctx.fill();
        ctx.fillStyle = "#33241a";
        ctx.beginPath(); ctx.ellipse(sx - R * 0.82, sy - R * 0.05, R * 0.08, R * 0.06, 0, 0, 7); ctx.fill(); // nose
        ctx.beginPath(); ctx.arc(sx - R * 0.5, sy - R * 0.2, R * 0.07, 0, 7); ctx.arc(sx - R * 0.26, sy - R * 0.22, R * 0.07, 0, 7); ctx.fill();
        ctx.fillStyle = "#e2626b";                                                    // a chewed toy in the jaws
        ctx.beginPath(); ctx.ellipse(sx - R * 0.72, sy + R * 0.16, R * 0.14, R * 0.1, 0.4, 0, 7); ctx.fill();
        ctx.strokeStyle = "#6f4c26"; ctx.lineWidth = Math.max(2, cell * 0.06);        // wagging tail
        ctx.beginPath(); ctx.moveTo(sx + R * 0.7, sy - R * 0.02);
        ctx.quadraticCurveTo(sx + R * 0.95, sy - R * (0.3 + 0.12 * Math.sin(engine.state.tick / 6)), sx + R * 0.86, sy - R * 0.42);
        ctx.stroke();
        bossCrown(sx - R * 0.4, sy - R * 0.55, R);   // over the head, not the middle of the body
      } else if (e.type === "blob" || e.type === "mudlet") {
        // Mud Blob / Mudlet: a gloopy brown blob with a wobble and a grumpy face
        const rr = (e.type === "blob" ? r * 1.0 : r * 0.62), w = Math.sin(engine.state.tick / 5 + e.id) * rr * 0.08;
        shadow(sx, sy + rr * 0.9, rr * 0.9, rr * 0.3);
        const gb = ctx.createRadialGradient(sx - rr * 0.3, sy - rr * 0.3, rr * 0.1, sx, sy, rr);
        gb.addColorStop(0, "#93a03f"); gb.addColorStop(1, "#4e5a18");
        ctx.fillStyle = gb;
        ctx.beginPath();
        ctx.moveTo(sx - rr, sy + rr * 0.6);
        ctx.quadraticCurveTo(sx - rr * 1.05, sy - rr * 0.7, sx - rr * 0.3, sy - rr * 0.8 + w);
        ctx.quadraticCurveTo(sx, sy - rr * 1.05, sx + rr * 0.3, sy - rr * 0.8 - w);
        ctx.quadraticCurveTo(sx + rr * 1.05, sy - rr * 0.7, sx + rr, sy + rr * 0.6);
        ctx.quadraticCurveTo(sx + rr, sy + rr * 0.95, sx, sy + rr * 0.9);
        ctx.quadraticCurveTo(sx - rr, sy + rr * 0.95, sx - rr, sy + rr * 0.6);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.85)";
        ctx.beginPath(); ctx.arc(sx - rr * 0.28, sy - rr * 0.1, rr * 0.16, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.arc(sx + rr * 0.28, sy - rr * 0.1, rr * 0.16, 0, 7); ctx.fill();
        ctx.fillStyle = "#241a0e";
        ctx.beginPath(); ctx.arc(sx - rr * 0.28, sy - rr * 0.08, rr * 0.08, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.arc(sx + rr * 0.28, sy - rr * 0.08, rr * 0.08, 0, 7); ctx.fill();
      } else if (e.type === "knight") {
        // Plastic Knight: a steel-blue armored toy with a shield emblem + helmet slit
        shadow(sx, sy + r * 0.5, r * 0.6, r * 0.2);
        const gk = ctx.createLinearGradient(sx - r, sy - r, sx + r, sy + r);
        gk.addColorStop(0, "#9db6ee"); gk.addColorStop(0.5, "#4f6ec4"); gk.addColorStop(1, "#2b3f86");
        ctx.fillStyle = gk;
        ctx.beginPath(); ctx.moveTo(sx, sy - r * 0.85);
        ctx.quadraticCurveTo(sx + r * 0.75, sy - r * 0.75, sx + r * 0.7, sy + r * 0.2);
        ctx.quadraticCurveTo(sx + r * 0.6, sy + r * 0.9, sx, sy + r * 0.95);
        ctx.quadraticCurveTo(sx - r * 0.6, sy + r * 0.9, sx - r * 0.7, sy + r * 0.2);
        ctx.quadraticCurveTo(sx - r * 0.75, sy - r * 0.75, sx, sy - r * 0.85);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = "#22336e"; ctx.lineWidth = Math.max(1, cell * 0.03);
        ctx.beginPath(); ctx.moveTo(sx - r * 0.32, sy - r * 0.28); ctx.lineTo(sx + r * 0.32, sy - r * 0.28); ctx.stroke(); // helmet slit
        ctx.fillStyle = "#22304a"; ctx.beginPath(); ctx.rect(sx - r * 0.28, sy - r * 0.32, r * 0.56, r * 0.14); ctx.fill();
        ctx.strokeStyle = "#ffe27a"; ctx.lineWidth = Math.max(1, cell * 0.045); ctx.lineCap = "round"; // shield cross
        ctx.beginPath(); ctx.moveTo(sx, sy + r * 0.12); ctx.lineTo(sx, sy + r * 0.62); ctx.moveTo(sx - r * 0.22, sy + r * 0.34); ctx.lineTo(sx + r * 0.22, sy + r * 0.34); ctx.stroke();
      } else if (e.type === "bull") {
        // Wind-up Bull: a tan bull with horns + a wind-up key; reddens while charging
        const charging = e.chargeUntil && engine.state.tick < e.chargeUntil;
        shadow(sx, sy + r * 0.5, r * 0.7, r * 0.22);
        ctx.strokeStyle = "#efe4c8"; ctx.lineWidth = Math.max(1.5, cell * 0.06); ctx.lineCap = "round"; // horns
        ctx.beginPath(); ctx.moveTo(sx - r * 0.55, sy - r * 0.35); ctx.quadraticCurveTo(sx - r * 0.8, sy - r * 0.7, sx - r * 0.5, sy - r * 0.85);
        ctx.moveTo(sx + r * 0.55, sy - r * 0.35); ctx.quadraticCurveTo(sx + r * 0.8, sy - r * 0.7, sx + r * 0.5, sy - r * 0.85); ctx.stroke();
        ctx.strokeStyle = "#c9b487"; ctx.lineWidth = Math.max(1.5, cell * 0.05); // wind-up key
        ctx.beginPath(); ctx.moveTo(sx, sy - r * 0.6); ctx.lineTo(sx, sy - r * 0.95); ctx.stroke();
        ctx.beginPath(); ctx.arc(sx - r * 0.12, sy - r, r * 0.12, 0, 7); ctx.arc(sx + r * 0.12, sy - r, r * 0.12, 0, 7); ctx.stroke();
        const gu = ctx.createRadialGradient(sx - r * 0.2, sy - r * 0.2, r * 0.1, sx, sy, r * 0.85);
        gu.addColorStop(0, charging ? "#e88a6a" : "#c9a877"); gu.addColorStop(1, charging ? "#b4482e" : "#8a6a3e");
        ctx.fillStyle = gu; ctx.beginPath(); ctx.ellipse(sx, sy + r * 0.08, r * 0.7, r * 0.62, 0, 0, 7); ctx.fill();
        ctx.fillStyle = "#3a2a18"; ctx.beginPath(); ctx.arc(sx - r * 0.22, sy - r * 0.05, r * 0.1, 0, 7); ctx.arc(sx + r * 0.22, sy - r * 0.05, r * 0.1, 0, 7); ctx.fill();
        ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.ellipse(sx, sy + r * 0.32, r * 0.18, r * 0.12, 0, 0, 7); ctx.fill(); // snout
        if (charging) { ctx.strokeStyle = "rgba(255,120,90,0.7)"; ctx.lineWidth = 2; for (let k = -1; k <= 1; k++) { ctx.beginPath(); ctx.moveTo(sx + r * 0.9, sy + k * r * 0.3); ctx.lineTo(sx + r * 1.3, sy + k * r * 0.3); ctx.stroke(); } }
      } else if (e.type === "healer") {
        // Junk Healer: a grey bot with a glowing green + (heal) and a wrench antenna
        shadow(sx, sy + r * 0.5, r * 0.55, r * 0.2);
        ctx.strokeStyle = "#1e7fa8"; ctx.lineWidth = Math.max(1, cell * 0.03);
        ctx.beginPath(); ctx.moveTo(sx, sy - r * 0.6); ctx.lineTo(sx, sy - r * 0.92); ctx.stroke();
        ctx.fillStyle = "#8f9db0"; ctx.beginPath(); ctx.arc(sx, sy - r * 0.98, r * 0.1, 0, 7); ctx.fill();
        const gh = ctx.createLinearGradient(sx, sy - r * 0.6, sx, sy + r * 0.7);
        gh.addColorStop(0, "#b9c4d2"); gh.addColorStop(1, "#79879a");
        ctx.fillStyle = gh; ctx.beginPath(); ctx.moveTo(sx - r * 0.6, sy - r * 0.45);
        ctx.arcTo(sx - r * 0.6, sy + r * 0.7, sx, sy + r * 0.7, r * 0.3); ctx.arcTo(sx + r * 0.6, sy + r * 0.7, sx + r * 0.6, sy - r * 0.45, r * 0.3);
        ctx.arcTo(sx + r * 0.6, sy - r * 0.6, sx, sy - r * 0.6, r * 0.3); ctx.arcTo(sx - r * 0.6, sy - r * 0.6, sx - r * 0.6, sy - r * 0.45, r * 0.3); ctx.closePath(); ctx.fill();
        const glow = 0.55 + 0.35 * Math.sin(engine.state.tick / 6 + e.id);
        ctx.fillStyle = "rgba(90,220,120," + glow.toFixed(2) + ")"; // heal +
        ctx.beginPath(); ctx.rect(sx - r * 0.08, sy - r * 0.28, r * 0.16, r * 0.7); ctx.rect(sx - r * 0.28, sy - r * 0.08, r * 0.56, r * 0.16); ctx.fill();
      } else if (e.type === "pinata") {
        // Piñata: a chubby festive body with colored frills + a little party face
        shadow(sx, sy + r * 0.85, r * 1.0, r * 0.28);
        const cols = ["#f25c78", "#ffd94a", "#5ac8e6", "#7ed957"];
        ctx.fillStyle = "#b64a86"; ctx.beginPath(); ctx.ellipse(sx, sy, r * 0.95, r * 0.85, 0, 0, 7); ctx.fill();
        for (let s = 0; s < 5; s++) { ctx.fillStyle = cols[s % cols.length]; ctx.beginPath(); ctx.ellipse(sx, sy - r * 0.7 + s * r * 0.4, r * 0.95, r * 0.14, 0, 0, 7); ctx.fill(); }
        ctx.strokeStyle = "#ffd94a"; ctx.lineWidth = Math.max(1, cell * 0.04); ctx.beginPath(); ctx.moveTo(sx, sy - r * 0.85); ctx.lineTo(sx, sy - r * 1.15); ctx.stroke(); // string
        ctx.fillStyle = "#241a2a"; ctx.beginPath(); ctx.arc(sx - r * 0.24, sy - r * 0.05, r * 0.08, 0, 7); ctx.arc(sx + r * 0.24, sy - r * 0.05, r * 0.08, 0, 7); ctx.fill();
      } else if (e.type === "brick") {
        // Brick: a red toy brick with mortar lines
        shadow(sx, sy + r * 0.45, r * 0.6, r * 0.16);
        const gr = ctx.createLinearGradient(sx, sy - r * 0.5, sx, sy + r * 0.5);
        gr.addColorStop(0, "#d16a4a"); gr.addColorStop(1, "#a94a30");
        ctx.fillStyle = gr; ctx.beginPath(); ctx.rect(sx - r * 0.7, sy - r * 0.42, r * 1.4, r * 0.84); ctx.fill();
        ctx.strokeStyle = "rgba(255,240,230,0.5)"; ctx.lineWidth = Math.max(1, cell * 0.03);
        ctx.beginPath(); ctx.moveTo(sx - r * 0.7, sy); ctx.lineTo(sx + r * 0.7, sy); ctx.moveTo(sx, sy - r * 0.42); ctx.lineTo(sx, sy); ctx.moveTo(sx - r * 0.35, sy); ctx.lineTo(sx - r * 0.35, sy + r * 0.42); ctx.moveTo(sx + r * 0.35, sy); ctx.lineTo(sx + r * 0.35, sy + r * 0.42); ctx.stroke();
      } else if (e.type === "bedmonster") {
        // Bed Monster boss: a big scary-cute bed with eyes + a toothy grin
        const R = r * bossScale(e, 1.9);
        shadow(sx, sy + R * 0.55, R * 0.8, R * 0.24);
        ctx.fillStyle = "#6a4a8a"; ctx.beginPath(); ctx.moveTo(sx - R * 0.7, sy - R * 0.2); ctx.lineTo(sx - R * 0.7, sy - R * 0.62); ctx.arcTo(sx - R * 0.7, sy - R * 0.78, sx - R * 0.5, sy - R * 0.78, R * 0.16); ctx.lineTo(sx + R * 0.5, sy - R * 0.78); ctx.arcTo(sx + R * 0.7, sy - R * 0.78, sx + R * 0.7, sy - R * 0.62, R * 0.16); ctx.lineTo(sx + R * 0.7, sy - R * 0.2); ctx.closePath(); ctx.fill(); // headboard
        const gm = ctx.createLinearGradient(sx, sy - R * 0.3, sx, sy + R * 0.5);
        gm.addColorStop(0, "#e7edf7"); gm.addColorStop(1, "#c2cbe0");
        ctx.fillStyle = gm; ctx.beginPath(); ctx.moveTo(sx - R * 0.8, sy + R * 0.5); ctx.arcTo(sx - R * 0.8, sy - R * 0.35, sx, sy - R * 0.35, R * 0.3); ctx.arcTo(sx + R * 0.8, sy - R * 0.35, sx + R * 0.8, sy + R * 0.5, R * 0.3); ctx.closePath(); ctx.fill(); // mattress
        ctx.fillStyle = "#e2626b"; ctx.beginPath(); ctx.ellipse(sx + R * 0.42, sy - R * 0.18, R * 0.3, R * 0.16, 0, 0, 7); ctx.fill(); // pillow
        // face on the mattress
        ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(sx - R * 0.28, sy + R * 0.02, R * 0.17, 0, 7); ctx.arc(sx + R * 0.05, sy + R * 0.02, R * 0.17, 0, 7); ctx.fill();
        ctx.fillStyle = "#2a1030"; ctx.beginPath(); ctx.arc(sx - R * 0.24, sy + R * 0.05, R * 0.08, 0, 7); ctx.arc(sx + R * 0.09, sy + R * 0.05, R * 0.08, 0, 7); ctx.fill();
        ctx.fillStyle = "#7a2030"; ctx.beginPath(); ctx.moveTo(sx - R * 0.35, sy + R * 0.26); ctx.quadraticCurveTo(sx, sy + R * 0.5, sx + R * 0.35, sy + R * 0.26); ctx.closePath(); ctx.fill(); // grin
        ctx.fillStyle = "#fff"; for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.moveTo(sx + k * R * 0.13, sy + R * 0.27); ctx.lineTo(sx + k * R * 0.13 + R * 0.06, sy + R * 0.27); ctx.lineTo(sx + k * R * 0.13 + R * 0.03, sy + R * 0.37); ctx.closePath(); ctx.fill(); } // teeth
        bossCrown(sx, sy - R * 0.35, R);   // the FIRST boss you meet had no boss mark at all
      } else if (e.type === "ghost") {
        // Glitter Ghost: a translucent sheet ghost; fades right out mid-phase so
        // the player SEES why it can't be targeted, then shimmers back.
        ctx.save();
        ctx.globalAlpha = (e.phaseHidden && !revealed(e)) ? 0.22 : 0.9;
        const rr = r * 0.95, w = Math.sin(engine.state.tick / 6 + e.id) * rr * 0.06;
        const gg = ctx.createLinearGradient(sx, sy - rr, sx, sy + rr);
        gg.addColorStop(0, "#f7e9ff"); gg.addColorStop(1, "#c9a2ee");
        ctx.fillStyle = gg;
        ctx.beginPath();
        ctx.arc(sx, sy - rr * 0.15, rr * 0.8, Math.PI, 0);
        ctx.lineTo(sx + rr * 0.8, sy + rr * 0.7 + w);
        for (let k = 2; k >= -2; k--) { const bx = sx + k * rr * 0.32; ctx.quadraticCurveTo(bx + rr * 0.16, sy + rr * (k % 2 ? 0.5 : 0.85), bx, sy + rr * 0.7 - w * (k % 2)); }
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = "#5b2f7a";
        ctx.beginPath(); ctx.arc(sx - rr * 0.26, sy - rr * 0.12, rr * 0.14, 0, 7); ctx.arc(sx + rr * 0.26, sy - rr * 0.12, rr * 0.14, 0, 7); ctx.fill();
        if (e.phaseHidden) { ctx.strokeStyle = "rgba(180,210,255,0.5)"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(sx, sy, rr * 1.1, 0, 7); ctx.stroke(); }
        ctx.restore();
      } else if (e.type === "battery") {
        // Battery Bot: a boxy tin robot; a blue shield bubble shows while charged
        shadow(sx, sy + r * 0.5, r * 0.6, r * 0.2);
        ctx.strokeStyle = "#1e7fa8"; ctx.lineWidth = Math.max(1, cell * 0.03);
        ctx.beginPath(); ctx.moveTo(sx - r * 0.2, sy - r * 0.62); ctx.lineTo(sx - r * 0.2, sy - r * 0.9); ctx.moveTo(sx + r * 0.2, sy - r * 0.62); ctx.lineTo(sx + r * 0.2, sy - r * 0.9); ctx.stroke();
        ctx.fillStyle = "#ffe9a8"; ctx.beginPath(); ctx.arc(sx - r * 0.2, sy - r * 0.94, r * 0.08, 0, 7); ctx.arc(sx + r * 0.2, sy - r * 0.94, r * 0.08, 0, 7); ctx.fill();
        const gbt = ctx.createLinearGradient(sx, sy - r * 0.6, sx, sy + r * 0.6);
        gbt.addColorStop(0, "#5ad2f0"); gbt.addColorStop(1, "#12688f");
        ctx.fillStyle = gbt; ctx.beginPath(); ctx.rect(sx - r * 0.6, sy - r * 0.6, r * 1.2, r * 1.2); ctx.fill();
        ctx.strokeStyle = "#0d4a66"; ctx.lineWidth = Math.max(1, cell * 0.03); ctx.strokeRect(sx - r * 0.6, sy - r * 0.6, r * 1.2, r * 1.2);
        ctx.fillStyle = "#22304a"; ctx.beginPath(); ctx.arc(sx - r * 0.22, sy - r * 0.16, r * 0.11, 0, 7); ctx.arc(sx + r * 0.22, sy - r * 0.16, r * 0.11, 0, 7); ctx.fill();
        // battery gauge (green bars)
        ctx.fillStyle = "#69d06a"; for (let k = 0; k < 3; k++) { ctx.fillRect(sx - r * 0.34 + k * r * 0.26, sy + r * 0.18, r * 0.16, r * 0.18); }
        if (e.shield > 0) { const sh = 0.4 + 0.3 * Math.sin(engine.state.tick / 5 + e.id); ctx.strokeStyle = "rgba(120,190,255," + sh.toFixed(2) + ")"; ctx.lineWidth = Math.max(2, cell * 0.06); ctx.beginPath(); ctx.arc(sx, sy, r * 1.05, 0, 7); ctx.stroke(); }
      } else if (e.type === "mole") {
        // Digger Mole: above ground a brown mole; in the middle third it BURROWS —
        // shown as a scrolling dirt mound (matches the engine's untargetable zone).
        const laneTot = engine.paths[e.pathIdx || 0].total; // its own lane's middle third
        const under = e.dist > laneTot / 3 && e.dist < (laneTot * 2) / 3 && !revealed(e);
        if (under) {
          ctx.fillStyle = "#6b6673"; ctx.beginPath(); ctx.ellipse(sx, sy + r * 0.2, r * 0.95, r * 0.5, 0, Math.PI, 0); ctx.fill();
          ctx.fillStyle = "#524d59"; for (let k = -1; k <= 1; k++) { ctx.beginPath(); ctx.arc(sx + k * r * 0.4, sy + r * 0.18, r * 0.14, 0, 7); ctx.fill(); }
          ctx.fillStyle = "rgba(120,90,55,0.6)"; ctx.beginPath(); ctx.moveTo(sx - r * 0.2, sy - r * 0.1); ctx.lineTo(sx, sy - r * 0.4); ctx.lineTo(sx + r * 0.2, sy - r * 0.1); ctx.closePath(); ctx.fill();
        } else {
          shadow(sx, sy + r * 0.5, r * 0.55, r * 0.18);
          const gml = ctx.createRadialGradient(sx - r * 0.2, sy - r * 0.2, r * 0.1, sx, sy, r * 0.9);
          gml.addColorStop(0, "#8f8a94"); gml.addColorStop(1, "#4a464f");
          ctx.fillStyle = gml; ctx.beginPath(); ctx.ellipse(sx, sy, r * 0.75, r * 0.68, 0, 0, 7); ctx.fill();
          ctx.fillStyle = "#f0c9a0"; ctx.beginPath(); ctx.ellipse(sx, sy + r * 0.28, r * 0.28, r * 0.2, 0, 0, 7); ctx.fill(); // snout
          ctx.fillStyle = "#3a2a18"; ctx.beginPath(); ctx.arc(sx, sy + r * 0.3, r * 0.08, 0, 7); ctx.fill();
          ctx.fillStyle = "#2a1c10"; ctx.beginPath(); ctx.arc(sx - r * 0.2, sy - r * 0.02, r * 0.07, 0, 7); ctx.arc(sx + r * 0.2, sy - r * 0.02, r * 0.07, 0, 7); ctx.fill();
          ctx.strokeStyle = "#e9dccb"; ctx.lineWidth = Math.max(1.5, cell * 0.05); ctx.lineCap = "round"; // claws
          ctx.beginPath(); ctx.moveTo(sx - r * 0.5, sy + r * 0.5); ctx.lineTo(sx - r * 0.66, sy + r * 0.62); ctx.moveTo(sx - r * 0.36, sy + r * 0.56); ctx.lineTo(sx - r * 0.48, sy + r * 0.72); ctx.stroke();
        }
      } else if (e.type === "hawk") {
        // Kite Hawk: a fast diamond kite with a bow tail — a flier, so it hovers
        shadow(sx, sy + cell * 0.5, r * 0.5, r * 0.18);
        const by = sy - cell * 0.05;
        const gh = ctx.createLinearGradient(sx, by - r * 0.7, sx, by + r * 0.7);
        gh.addColorStop(0, "#ff8f5a"); gh.addColorStop(1, "#e0552f");
        ctx.fillStyle = gh;
        ctx.beginPath(); ctx.moveTo(sx, by - r * 0.75); ctx.lineTo(sx + r * 0.55, by); ctx.lineTo(sx, by + r * 0.75); ctx.lineTo(sx - r * 0.55, by); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.6)"; ctx.lineWidth = Math.max(1, cell * 0.025);
        ctx.beginPath(); ctx.moveTo(sx, by - r * 0.75); ctx.lineTo(sx, by + r * 0.75); ctx.moveTo(sx - r * 0.55, by); ctx.lineTo(sx + r * 0.55, by); ctx.stroke();
        // bow tail (flutters)
        const fl = Math.sin(engine.state.tick / 3 + e.id) * r * 0.2;
        ctx.strokeStyle = "#ffd94a"; ctx.lineWidth = Math.max(1.5, cell * 0.04);
        ctx.beginPath(); ctx.moveTo(sx, by + r * 0.75); ctx.quadraticCurveTo(sx + fl, by + r * 1.1, sx - fl, by + r * 1.4); ctx.stroke();
        ctx.fillStyle = "#22304a"; ctx.beginPath(); ctx.arc(sx - r * 0.12, by, r * 0.08, 0, 7); ctx.arc(sx + r * 0.12, by, r * 0.08, 0, 7); ctx.fill();
      } else if (e.type === "vacuumking") {
        // Vacuum King boss: a swirling tornado with a little gold crown
        const R = r * bossScale(e, 1.8), spin = engine.state.tick * 0.2;
        shadow(sx, sy + R * 0.55, R * 0.7, R * 0.2);
        const gv = ctx.createLinearGradient(sx, sy - R * 0.8, sx, sy + R * 0.7);
        gv.addColorStop(0, "#8fa6c8"); gv.addColorStop(1, "#4c5e80");
        ctx.fillStyle = gv;
        ctx.beginPath();
        ctx.moveTo(sx - R * 0.7, sy - R * 0.75); ctx.quadraticCurveTo(sx, sy - R, sx + R * 0.7, sy - R * 0.75);
        ctx.quadraticCurveTo(sx + R * 0.2, sy - R * 0.1, sx + R * 0.28, sy + R * 0.5);
        ctx.quadraticCurveTo(sx, sy + R * 0.72, sx - R * 0.28, sy + R * 0.5);
        ctx.quadraticCurveTo(sx - R * 0.2, sy - R * 0.1, sx - R * 0.7, sy - R * 0.75); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.35)"; ctx.lineWidth = Math.max(2, cell * 0.06);
        for (let k = 0; k < 4; k++) { const yy = sy - R * 0.6 + k * R * 0.35, ph = spin + k; ctx.beginPath(); ctx.ellipse(sx + Math.sin(ph) * R * 0.12, yy, R * (0.62 - k * 0.12), R * 0.1, 0, 0, 7); ctx.stroke(); }
        ctx.fillStyle = "#22304a"; ctx.beginPath(); ctx.arc(sx - R * 0.16, sy - R * 0.35, R * 0.1, 0, 7); ctx.arc(sx + R * 0.16, sy - R * 0.35, R * 0.1, 0, 7); ctx.fill();
        bossCrown(sx, sy - R * 0.78, R);
      } else if (e.type === "thestatic") {
        // The Static boss: a crackling electric cloud; brighter as it escalates
        const R = r * bossScale(e, 1.85), frac = e.hp / e.maxHp;
        const hot = frac <= 0.33 ? 1 : frac <= 0.66 ? 0.6 : 0.3;
        shadow(sx, sy + R * 0.5, R * 0.75, R * 0.22);
        const gc = ctx.createRadialGradient(sx, sy, R * 0.2, sx, sy, R);
        gc.addColorStop(0, "#5a6b8f"); gc.addColorStop(1, "#2e3a55");
        ctx.fillStyle = gc;
        ctx.beginPath();
        for (let k = 0; k < 9; k++) { const a = (k / 9) * Math.PI * 2, rr = R * (0.7 + 0.18 * Math.sin(k * 2 + engine.state.tick / 8)); const px = sx + Math.cos(a) * rr, py = sy + Math.sin(a) * rr * 0.8; k ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = "rgba(180,220,255," + (0.5 + 0.5 * hot) + ")"; ctx.lineWidth = Math.max(1.5, cell * 0.05); ctx.lineCap = "round";
        for (let k = 0; k < 3; k++) { const a = engine.state.tick * 0.3 + k * 2.1; ctx.beginPath(); ctx.moveTo(sx, sy); let bx = sx, by = sy; for (let j = 0; j < 3; j++) { bx += Math.cos(a + j) * R * 0.3; by += Math.sin(a + j) * R * 0.3; ctx.lineTo(bx + (j % 2 ? R * 0.12 : -R * 0.12), by); } ctx.stroke(); }
        ctx.fillStyle = "#fff2a0"; ctx.beginPath(); ctx.arc(sx - R * 0.2, sy - R * 0.12, R * 0.12, 0, 7); ctx.arc(sx + R * 0.2, sy - R * 0.12, R * 0.12, 0, 7); ctx.fill();
        ctx.fillStyle = "#22304a"; ctx.beginPath(); ctx.arc(sx - R * 0.2, sy - R * 0.12, R * 0.05, 0, 7); ctx.arc(sx + R * 0.2, sy - R * 0.12, R * 0.05, 0, 7); ctx.fill();
        bossCrown(sx, sy - R * 0.62, R);
      } else if (e.type === "cushion") {
        // Couch Cushion: a plump square pillow, corner tassels, a sleepy face.
        // Reads SOFT on purpose — it soaks blasts, so it should look like it would.
        shadow(sx, sy + cell * 0.36, r * 0.9, r * 0.26);
        const g = ctx.createLinearGradient(sx - r, sy - r, sx + r, sy + r);
        g.addColorStop(0, "#c98a6a"); g.addColorStop(1, "#9c5f45");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(sx - r * 0.9, sy - r * 0.62);
        ctx.quadraticCurveTo(sx, sy - r * 0.95, sx + r * 0.9, sy - r * 0.62);
        ctx.quadraticCurveTo(sx + r * 1.16, sy, sx + r * 0.9, sy + r * 0.62);
        ctx.quadraticCurveTo(sx, sy + r * 0.95, sx - r * 0.9, sy + r * 0.62);
        ctx.quadraticCurveTo(sx - r * 1.16, sy, sx - r * 0.9, sy - r * 0.62);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = "rgba(255,235,215,0.28)";
        ctx.beginPath(); ctx.ellipse(sx - r * 0.3, sy - r * 0.32, r * 0.32, r * 0.16, -0.4, 0, 7); ctx.fill();
        ctx.fillStyle = "#7a4630"; // button dimple in the middle
        ctx.beginPath(); ctx.arc(sx, sy, r * 0.13, 0, 7); ctx.fill();
        ctx.fillStyle = "#22304a";
        ctx.beginPath(); ctx.arc(sx - r * 0.34, sy - r * 0.06, r * 0.09, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.arc(sx + r * 0.34, sy - r * 0.06, r * 0.09, 0, 7); ctx.fill();
      } else if (e.type === "screw") {
        // Loose Screw: a slotted head that keeps turning — it jams your guns.
        shadow(sx, sy + cell * 0.34, r * 0.6, r * 0.2);
        const g = ctx.createLinearGradient(sx - r * 0.6, sy - r, sx + r * 0.6, sy + r);
        g.addColorStop(0, "#d98f5a"); g.addColorStop(1, "#8a4a18");
        ctx.fillStyle = g;
        ctx.beginPath(); // tapered shank
        ctx.moveTo(sx - r * 0.32, sy - r * 0.2);
        ctx.lineTo(sx + r * 0.32, sy - r * 0.2);
        ctx.lineTo(sx + r * 0.12, sy + r * 1.0);
        ctx.lineTo(sx - r * 0.12, sy + r * 1.0);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = "rgba(60,72,92,0.55)"; ctx.lineWidth = Math.max(1, cell * 0.022);
        for (let k = 0; k < 3; k++) { const yy = sy + r * (0.05 + k * 0.3); ctx.beginPath(); ctx.moveTo(sx - r * 0.28 + k * r * 0.05, yy); ctx.lineTo(sx + r * 0.28 - k * r * 0.05, yy + r * 0.1); ctx.stroke(); }
        ctx.fillStyle = g; // round head
        ctx.beginPath(); ctx.ellipse(sx, sy - r * 0.42, r * 0.66, r * 0.44, 0, 0, 7); ctx.fill();
        ctx.strokeStyle = "#5c3410"; ctx.lineWidth = Math.max(1.5, cell * 0.045); ctx.lineCap = "round";
        const a = engine.state.tick * 0.16; // the slot spins — it is working loose
        ctx.beginPath();
        ctx.moveTo(sx - Math.cos(a) * r * 0.42, sy - r * 0.42 - Math.sin(a) * r * 0.26);
        ctx.lineTo(sx + Math.cos(a) * r * 0.42, sy - r * 0.42 + Math.sin(a) * r * 0.26);
        ctx.stroke();
        ctx.fillStyle = "#22304a";
        ctx.beginPath(); ctx.arc(sx - r * 0.22, sy - r * 0.5, r * 0.07, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.arc(sx + r * 0.22, sy - r * 0.5, r * 0.07, 0, 7); ctx.fill();
      } else if (e.type === "slime") {
        // Drip Slime: a wobbling droplet that GROWS while it is slowed.
        shadow(sx, sy + cell * 0.34, r * 0.7, r * 0.22);
        const wob = Math.sin(engine.state.tick / 7) * r * 0.08;
        const g = ctx.createRadialGradient(sx - r * 0.3, sy - r * 0.3, r * 0.1, sx, sy, r * 1.1);
        g.addColorStop(0, "#9df3b8"); g.addColorStop(1, "#2f9c5c");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(sx, sy - r * 1.0 - wob);
        ctx.quadraticCurveTo(sx + r * 0.95, sy + r * 0.1, sx + r * 0.5, sy + r * 0.7);
        ctx.quadraticCurveTo(sx, sy + r * 1.12, sx - r * 0.5, sy + r * 0.7);
        ctx.quadraticCurveTo(sx - r * 0.95, sy + r * 0.1, sx, sy - r * 1.0 - wob);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.55)";
        ctx.beginPath(); ctx.ellipse(sx - r * 0.28, sy - r * 0.1, r * 0.16, r * 0.26, -0.4, 0, 7); ctx.fill();
        ctx.fillStyle = "#12432a";
        ctx.beginPath(); ctx.arc(sx - r * 0.24, sy + r * 0.18, r * 0.1, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.arc(sx + r * 0.24, sy + r * 0.18, r * 0.1, 0, 7); ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.beginPath(); ctx.arc(sx - r * 0.27, sy + r * 0.14, r * 0.035, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.arc(sx + r * 0.21, sy + r * 0.14, r * 0.035, 0, 7); ctx.fill();
      } else if (e.type === "tinplane") {
        // Tin Plane: a little riveted tin aeroplane — ARMOURED and it flies, so
        // it reads metal (plates + rivets) rather than soft, and it banks.
        const bank = Math.sin(engine.state.tick / 9 + e.id) * 0.16;
        ctx.save(); ctx.translate(sx, sy); ctx.rotate(bank);
        const g = ctx.createLinearGradient(0, -r, 0, r);
        g.addColorStop(0, "#f0817a"); g.addColorStop(1, "#b03a33");
        ctx.fillStyle = g; // wings
        ctx.beginPath();
        ctx.moveTo(-r * 1.15, r * 0.06); ctx.lineTo(-r * 0.2, -r * 0.2);
        ctx.lineTo(r * 0.2, -r * 0.2); ctx.lineTo(r * 1.15, r * 0.06);
        ctx.lineTo(r * 0.2, r * 0.3); ctx.lineTo(-r * 0.2, r * 0.3);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = "#d9534a"; // fuselage
        ctx.beginPath(); ctx.ellipse(0, 0, r * 0.34, r * 0.9, 0, 0, 7); ctx.fill();
        ctx.fillStyle = "#8f2b26"; // tail fin
        ctx.beginPath(); ctx.moveTo(0, r * 0.62); ctx.lineTo(-r * 0.42, r * 1.02); ctx.lineTo(r * 0.42, r * 1.02); ctx.closePath(); ctx.fill();
        ctx.fillStyle = "#f4c9a0"; // rivets down the plates
        for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.arc(0, k * r * 0.3, r * 0.055, 0, 7); ctx.fill(); }
        ctx.fillStyle = "#7fe3ff"; // canopy
        ctx.beginPath(); ctx.ellipse(0, -r * 0.42, r * 0.2, r * 0.28, 0, 0, 7); ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.7)"; ctx.lineWidth = Math.max(1.5, cell * 0.05); // prop blur
        ctx.beginPath(); ctx.ellipse(0, -r * 0.95, r * 0.5, r * 0.1, 0, 0, 7); ctx.stroke();
        ctx.restore();
      } else if (e.type === "tickmaster") {
        // The Tickmaster (World-4 boss): a battered wind-up alarm clock. Its HANDS
        // spin faster as it escalates, so the hp-gated phases are readable on the
        // enemy itself, not only in the banner.
        const R = r * bossScale(e, 1.8), frac = e.hp / (e.maxHp || 1);
        const rage = frac <= 0.33 ? 3.2 : frac <= 0.66 ? 1.8 : 1;
        shadow(sx, sy + R * 0.55, R * 0.72, R * 0.2);
        ctx.fillStyle = "#8d99ad"; // bells
        ctx.beginPath(); ctx.arc(sx - R * 0.66, sy - R * 0.66, R * 0.26, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.arc(sx + R * 0.66, sy - R * 0.66, R * 0.26, 0, 7); ctx.fill();
        ctx.strokeStyle = "#6d788c"; ctx.lineWidth = Math.max(2, cell * 0.07); // feet
        ctx.beginPath(); ctx.moveTo(sx - R * 0.4, sy + R * 0.78); ctx.lineTo(sx - R * 0.6, sy + R * 1.0); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(sx + R * 0.4, sy + R * 0.78); ctx.lineTo(sx + R * 0.6, sy + R * 1.0); ctx.stroke();
        const gk = ctx.createRadialGradient(sx - R * 0.25, sy - R * 0.25, R * 0.15, sx, sy, R);
        gk.addColorStop(0, "#e3e9f4"); gk.addColorStop(1, "#96a2b6");
        ctx.fillStyle = gk; ctx.beginPath(); ctx.arc(sx, sy, R * 0.86, 0, 7); ctx.fill();
        ctx.strokeStyle = "#59647a"; ctx.lineWidth = Math.max(2, cell * 0.08); ctx.stroke();
        ctx.fillStyle = "#fdf6e6"; ctx.beginPath(); ctx.arc(sx, sy, R * 0.68, 0, 7); ctx.fill();
        ctx.fillStyle = "#59647a"; // hour ticks
        for (let k = 0; k < 12; k++) {
          const a = (k / 12) * Math.PI * 2;
          ctx.beginPath(); ctx.arc(sx + Math.cos(a) * R * 0.56, sy + Math.sin(a) * R * 0.56, R * 0.045, 0, 7); ctx.fill();
        }
        const spin = engine.state.tick * 0.05 * rage;
        ctx.strokeStyle = "#22304a"; ctx.lineCap = "round";
        ctx.lineWidth = Math.max(2, cell * 0.09);
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + Math.cos(spin - 1.57) * R * 0.34, sy + Math.sin(spin - 1.57) * R * 0.34); ctx.stroke();
        ctx.lineWidth = Math.max(1.5, cell * 0.06);
        ctx.strokeStyle = frac <= 0.33 ? "#ff6f6f" : "#22304a";
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + Math.cos(spin * 6 - 1.57) * R * 0.54, sy + Math.sin(spin * 6 - 1.57) * R * 0.54); ctx.stroke();
        ctx.fillStyle = "#ffd94a"; ctx.beginPath(); ctx.arc(sx, sy, R * 0.09, 0, 7); ctx.fill();
        ctx.fillStyle = "#22304a"; // eyes on the rim, above the dial
        ctx.beginPath(); ctx.arc(sx - R * 0.26, sy - R * 0.4, R * 0.09, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.arc(sx + R * 0.26, sy - R * 0.4, R * 0.09, 0, 7); ctx.fill();
        bossCrown(sx, sy - R * 0.9, R);
      } else if (e.type === "bubblewrap") {
        // Bubble Wrap: a fat roll of wrap, its bubbles visibly intact. Single
        // hits pop one at a time, so the picture has to look like MANY small
        // cushions rather than one body — that IS the mechanic.
        shadow(sx, sy + r * 0.55, r * 0.72, r * 0.2);
        const gw = ctx.createLinearGradient(sx - r * 0.6, 0, sx + r * 0.6, 0);
        gw.addColorStop(0, "#9fd8e8"); gw.addColorStop(0.45, "#e6f7ff"); gw.addColorStop(1, "#84bccd");
        ctx.fillStyle = gw;
        ctx.beginPath(); ctx.roundRect ? ctx.roundRect(sx - r * 0.62, sy - r * 0.5, r * 1.24, r * 1.0, r * 0.26)
                                       : ctx.rect(sx - r * 0.62, sy - r * 0.5, r * 1.24, r * 1.0);
        ctx.fill();
        ctx.strokeStyle = "rgba(90,150,170,0.8)"; ctx.lineWidth = Math.max(1.5, cell * 0.045); ctx.stroke();
        ctx.fillStyle = "rgba(255,255,255,0.75)";                 // the bubbles
        for (let ry = -1; ry <= 1; ry++) for (let rx = -1; rx <= 1; rx++) {
          ctx.beginPath(); ctx.arc(sx + rx * r * 0.34, sy + ry * r * 0.3, r * 0.11, 0, 7); ctx.fill();
        }
        ctx.fillStyle = "#2a3140";
        ctx.beginPath(); ctx.arc(sx - r * 0.2, sy + r * 0.62, r * 0.07, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.arc(sx + r * 0.2, sy + r * 0.62, r * 0.07, 0, 7); ctx.fill();
      } else if (e.type === "duck") {
        // Rubber Duck: a fat bath duck sitting low, with a visible RUBBER
        // highlight — the tell is that it looks bouncy/insulating, which is why
        // the zap slides off it. Distinct silhouette from every other body: a
        // round base + a raised head + a wedge beak (the near-twin check compares
        // a tight box, so a generic blob would not pass).
        shadow(sx, sy + r * 0.5, r * 0.66, r * 0.2);
        const gd = ctx.createLinearGradient(0, sy - r * 0.5, 0, sy + r * 0.55);
        gd.addColorStop(0, "#ffe066"); gd.addColorStop(0.6, "#f5b800"); gd.addColorStop(1, "#c98d00");
        ctx.fillStyle = gd;
        ctx.beginPath(); ctx.ellipse(sx, sy + r * 0.16, r * 0.62, r * 0.42, 0, 0, 7); ctx.fill();  // body
        ctx.beginPath(); ctx.arc(sx + r * 0.2, sy - r * 0.34, r * 0.3, 0, 7); ctx.fill();          // head
        ctx.fillStyle = "#ff8c1a";                                                                 // beak
        ctx.beginPath();
        ctx.moveTo(sx + r * 0.44, sy - r * 0.36);
        ctx.lineTo(sx + r * 0.86, sy - r * 0.26);
        ctx.lineTo(sx + r * 0.44, sy - r * 0.16);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.7)";                                                   // rubber sheen
        ctx.beginPath(); ctx.ellipse(sx - r * 0.24, sy - r * 0.02, r * 0.2, r * 0.1, -0.5, 0, 7); ctx.fill();
        ctx.fillStyle = "#2a3140";
        ctx.beginPath(); ctx.arc(sx + r * 0.28, sy - r * 0.42, r * 0.07, 0, 7); ctx.fill();         // eye
      } else if (e.type === "drum") {
        // Oil Drum: an upright barrel — a TALL rectangle with two hoop ribs and a
        // lid rim, which is a silhouette nothing else in the roster has (every
        // other body is round, boxy-wide or winged). Deep petrol green so it
        // clears the garage's steel-and-brown pool by a wide margin, with a
        // rainbow oil sheen that says "this thing is full of slippery stuff"
        // BEFORE it ever dies and proves it.
        shadow(sx, sy + r * 0.62, r * 0.5, r * 0.16);
        const gb = ctx.createLinearGradient(sx - r * 0.44, 0, sx + r * 0.44, 0);
        gb.addColorStop(0, "#1d4d3a"); gb.addColorStop(0.42, "#2f7d5c"); gb.addColorStop(1, "#173f30");
        ctx.fillStyle = gb;
        ctx.beginPath(); ctx.rect(sx - r * 0.44, sy - r * 0.62, r * 0.88, r * 1.24); ctx.fill();
        ctx.fillStyle = "#3f9a72";                                        // lid
        ctx.beginPath(); ctx.ellipse(sx, sy - r * 0.62, r * 0.44, r * 0.15, 0, 0, 7); ctx.fill();
        ctx.fillStyle = "#123328";                                        // two hoop ribs
        ctx.beginPath(); ctx.rect(sx - r * 0.46, sy - r * 0.24, r * 0.92, r * 0.13); ctx.fill();
        ctx.beginPath(); ctx.rect(sx - r * 0.46, sy + r * 0.16, r * 0.92, r * 0.13); ctx.fill();
        ctx.fillStyle = "rgba(126, 214, 255, 0.5)";                       // oil sheen
        ctx.beginPath(); ctx.ellipse(sx - r * 0.16, sy - r * 0.44, r * 0.13, r * 0.3, 0.25, 0, 7); ctx.fill();
      } else if (e.type === "boombox") {
        // Boom Box: a chunky stereo with two speakers and sound rings pulsing
        // out of it — the rings are the tell, because the threat is the AURA,
        // not the body. They pulse off state.tick, so they freeze when paused.
        shadow(sx, sy + r * 0.5, r * 0.7, r * 0.18);
        const ph = (engine.state.tick * 0.06) % 1;
        ctx.strokeStyle = "rgba(255,180,90," + (0.45 * (1 - ph)).toFixed(3) + ")";
        ctx.lineWidth = Math.max(1.5, cell * 0.05);
        ctx.beginPath(); ctx.arc(sx, sy, r * (0.7 + ph * 0.7), 0, 7); ctx.stroke();
        ctx.fillStyle = "#8e3aa0";
        ctx.beginPath(); ctx.roundRect ? ctx.roundRect(sx - r * 0.66, sy - r * 0.36, r * 1.32, r * 0.78, r * 0.12)
                                       : ctx.rect(sx - r * 0.66, sy - r * 0.36, r * 1.32, r * 0.78);
        ctx.fill();
        ctx.strokeStyle = "#20262f"; ctx.lineWidth = Math.max(1.5, cell * 0.04); ctx.stroke();
        ctx.strokeStyle = "#e0a8e8"; ctx.lineWidth = Math.max(2, cell * 0.05);   // handle
        ctx.beginPath(); ctx.arc(sx, sy - r * 0.36, r * 0.36, Math.PI, 0); ctx.stroke();
        for (const dx of [-0.34, 0.34]) {                                        // speakers
          ctx.fillStyle = "#1b2029";
          ctx.beginPath(); ctx.arc(sx + r * dx, sy + r * 0.04, r * 0.22, 0, 7); ctx.fill();
          ctx.fillStyle = "#c86ad0";
          ctx.beginPath(); ctx.arc(sx + r * dx, sy + r * 0.04, r * 0.09, 0, 7); ctx.fill();
        }
        ctx.fillStyle = "#ffd35c";                                               // the dial
        ctx.fillRect(sx - r * 0.1, sy - r * 0.24, r * 0.2, r * 0.08);
      } else if (e.type === "movingvan") {
        // The Moving Van (World-6 boss): a box truck with its roller door up,
        // stacked with boxes it keeps unloading. The door RISES as its hp-gated
        // phases escalate, so the phase reads on the boss itself — the
        // Tickmaster's spinning hands and the Titan's gaping lid, again.
        const R = r * bossScale(e, 1.8), frac = e.hp / (e.maxHp || 1);
        const open = frac <= 0.33 ? 0.66 : frac <= 0.66 ? 0.4 : 0.16;
        shadow(sx, sy + R * 0.66, R * 0.9, R * 0.2);
        ctx.fillStyle = "#2a3140";                                               // wheels
        for (const dx of [-0.52, 0.42]) { ctx.beginPath(); ctx.arc(sx + R * dx, sy + R * 0.58, R * 0.17, 0, 7); ctx.fill(); }
        const gv = ctx.createLinearGradient(sx, sy - R * 0.5, sx, sy + R * 0.5);
        gv.addColorStop(0, "#eef2f8"); gv.addColorStop(1, "#b9c3d2");
        ctx.fillStyle = gv;                                                      // the box body
        ctx.beginPath();
        ctx.moveTo(sx - R * 0.78, sy - R * 0.46); ctx.lineTo(sx + R * 0.34, sy - R * 0.46);
        ctx.lineTo(sx + R * 0.34, sy + R * 0.5); ctx.lineTo(sx - R * 0.78, sy + R * 0.5);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = "#6b7688"; ctx.lineWidth = Math.max(2, cell * 0.06); ctx.stroke();
        ctx.fillStyle = "#8d99ad";                                               // cab
        ctx.beginPath();
        ctx.moveTo(sx + R * 0.34, sy - R * 0.1); ctx.lineTo(sx + R * 0.62, sy - R * 0.1);
        ctx.lineTo(sx + R * 0.78, sy + R * 0.18); ctx.lineTo(sx + R * 0.78, sy + R * 0.5);
        ctx.lineTo(sx + R * 0.34, sy + R * 0.5); ctx.closePath(); ctx.fill();
        ctx.fillStyle = "#cfe3f5";
        ctx.fillRect(sx + R * 0.42, sy + R * 0.02, R * 0.26, R * 0.2);           // windscreen
        ctx.fillStyle = "#4a5462";                                               // the dark hold
        ctx.fillRect(sx - R * 0.7, sy - R * 0.38, R * 0.96, R * 0.8);
        ctx.fillStyle = "#c08a48";                                               // boxes inside
        for (const [bx, by] of [[-0.5, 0.18], [-0.16, 0.18], [-0.34, -0.12]]) {
          ctx.fillRect(sx + R * bx, sy + R * by, R * 0.28, R * 0.24);
          ctx.strokeStyle = "#8a5f2c"; ctx.lineWidth = Math.max(1, cell * 0.03);
          ctx.strokeRect(sx + R * bx, sy + R * by, R * 0.28, R * 0.24);
        }
        ctx.fillStyle = "#dfe6f0";                                               // the roller door, riding up
        ctx.fillRect(sx - R * 0.72, sy - R * 0.42, R * 1.0, R * 0.84 * (1 - open));
        ctx.strokeStyle = "#98a3b4"; ctx.lineWidth = Math.max(1, cell * 0.025);
        for (let k = 1; k < 5; k++) {
          const yy = sy - R * 0.42 + (R * 0.84 * (1 - open)) * (k / 5);
          ctx.beginPath(); ctx.moveTo(sx - R * 0.72, yy); ctx.lineTo(sx + R * 0.28, yy); ctx.stroke();
        }
        bossCrown(sx, sy - R * 0.86, R);
      } else if (e.type === "racer") {
        // Grease Racer: a skateboard with a grease-slick trail. Low, wide and
        // leaning forward — it should READ as fast, because "slows do nothing"
        // is only fair if you can see which one is the runner.
        shadow(sx, sy + r * 0.5, r * 0.9, r * 0.22);
        ctx.save(); ctx.translate(sx, sy); ctx.rotate(-0.12);
        ctx.strokeStyle = "rgba(120,200,255,0.5)"; ctx.lineWidth = Math.max(1.5, cell * 0.05); // speed lines
        for (let k = -1; k <= 1; k++) {
          ctx.beginPath(); ctx.moveTo(-r * 1.5, k * r * 0.34); ctx.lineTo(-r * 0.85, k * r * 0.34); ctx.stroke();
        }
        ctx.fillStyle = "#39424f"; // wheels
        ctx.beginPath(); ctx.arc(-r * 0.5, r * 0.42, r * 0.2, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.arc(r * 0.5, r * 0.42, r * 0.2, 0, 7); ctx.fill();
        const gd = ctx.createLinearGradient(0, -r * 0.4, 0, r * 0.2);
        gd.addColorStop(0, "#ff9f45"); gd.addColorStop(1, "#c2661d");
        ctx.fillStyle = gd; // deck
        ctx.beginPath();
        ctx.moveTo(-r * 0.95, r * 0.02); ctx.quadraticCurveTo(-r * 1.12, -r * 0.36, -r * 0.62, -r * 0.3);
        ctx.lineTo(r * 0.62, -r * 0.3); ctx.quadraticCurveTo(r * 1.12, -r * 0.36, r * 0.95, r * 0.02);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = "#2a3140"; // grip tape
        ctx.fillRect(-r * 0.58, -r * 0.3, r * 1.16, r * 0.1);
        ctx.fillStyle = "#ffe9a8"; // a determined little face on the nose
        ctx.beginPath(); ctx.arc(r * 0.72, -r * 0.52, r * 0.3, 0, 7); ctx.fill();
        ctx.fillStyle = "#2a3140";
        ctx.beginPath(); ctx.arc(r * 0.8, -r * 0.58, r * 0.07, 0, 7); ctx.fill();
        ctx.restore();
      } else if (e.type === "bucket") {
        // Bolt Bucket: a galvanised pail brimming with bolts, one spilling over
        // the rim — the drip is the whole mechanic, so it shows on the sprite.
        shadow(sx, sy + r * 0.6, r * 0.7, r * 0.2);
        const gb = ctx.createLinearGradient(sx - r * 0.6, 0, sx + r * 0.6, 0);
        gb.addColorStop(0, "#3f9aa8"); gb.addColorStop(0.45, "#7fd2dd"); gb.addColorStop(1, "#1e5f6b");
        ctx.fillStyle = gb;
        ctx.beginPath();
        ctx.moveTo(sx - r * 0.62, sy - r * 0.42); ctx.lineTo(sx + r * 0.62, sy - r * 0.42);
        ctx.lineTo(sx + r * 0.44, sy + r * 0.62); ctx.lineTo(sx - r * 0.44, sy + r * 0.62);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = "#154a54"; ctx.lineWidth = Math.max(1.5, cell * 0.05); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(sx - r * 0.55, sy + r * 0.12); ctx.lineTo(sx + r * 0.55, sy + r * 0.12); ctx.stroke(); // rib
        ctx.strokeStyle = "#2b7f8c"; ctx.lineWidth = Math.max(2, cell * 0.06); // handle
        ctx.beginPath(); ctx.arc(sx, sy - r * 0.44, r * 0.6, Math.PI, 0); ctx.stroke();
        ctx.fillStyle = "#b9762f"; // bolts heaped above the rim
        for (const [bx, by] of [[-0.34, -0.56], [0, -0.66], [0.34, -0.54], [-0.14, -0.44], [0.18, -0.42]]) {
          ctx.beginPath(); ctx.arc(sx + r * bx, sy + r * by, r * 0.15, 0, 7); ctx.fill();
        }
        ctx.fillStyle = "#8f5620"; // one spilling out of the side
        ctx.beginPath(); ctx.arc(sx + r * 0.74, sy + r * 0.3, r * 0.14, 0, 7); ctx.fill();
        ctx.fillStyle = "#2a3140";
        ctx.beginPath(); ctx.arc(sx - r * 0.18, sy + r * 0.3, r * 0.07, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.arc(sx + r * 0.18, sy + r * 0.3, r * 0.07, 0, 7); ctx.fill();
      } else if (e.type === "titan") {
        // The Toolbox Titan (World-5 boss): a red steel toolbox stomping on two
        // stubby legs, its tray-lid cracked open. The lid gapes wider as its
        // hp-gated phases escalate, so the phase reads on the boss itself — the
        // Tickmaster's spinning hands, applied to a different silhouette.
        const R = r * bossScale(e, 1.8), frac = e.hp / (e.maxHp || 1);
        const gape = frac <= 0.33 ? 0.62 : frac <= 0.66 ? 0.34 : 0.12;
        shadow(sx, sy + R * 0.62, R * 0.8, R * 0.2);
        ctx.strokeStyle = "#4a5462"; ctx.lineWidth = Math.max(2, cell * 0.09); // legs
        ctx.beginPath(); ctx.moveTo(sx - R * 0.42, sy + R * 0.5); ctx.lineTo(sx - R * 0.5, sy + R * 0.92); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(sx + R * 0.42, sy + R * 0.5); ctx.lineTo(sx + R * 0.5, sy + R * 0.92); ctx.stroke();
        ctx.save(); // the cracked-open lid, hinged at the back
        ctx.translate(sx - R * 0.72, sy - R * 0.34); ctx.rotate(-gape);
        ctx.fillStyle = "#8e2f2a";
        ctx.fillRect(0, -R * 0.2, R * 1.44, R * 0.22);
        ctx.strokeStyle = "#5d1c19"; ctx.lineWidth = Math.max(1.5, cell * 0.05);
        ctx.strokeRect(0, -R * 0.2, R * 1.44, R * 0.22);
        ctx.restore();
        const gt = ctx.createLinearGradient(sx, sy - R * 0.4, sx, sy + R * 0.5);
        gt.addColorStop(0, "#d6453c"); gt.addColorStop(1, "#8e2f2a");
        ctx.fillStyle = gt; // body
        ctx.beginPath();
        ctx.moveTo(sx - R * 0.72, sy - R * 0.3); ctx.lineTo(sx + R * 0.72, sy - R * 0.3);
        ctx.lineTo(sx + R * 0.62, sy + R * 0.52); ctx.lineTo(sx - R * 0.62, sy + R * 0.52);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = "#5d1c19"; ctx.lineWidth = Math.max(2, cell * 0.07); ctx.stroke();
        ctx.fillStyle = "#c8cfdb"; // latch + drawer pull
        ctx.fillRect(sx - R * 0.1, sy - R * 0.08, R * 0.2, R * 0.16);
        ctx.fillRect(sx - R * 0.4, sy + R * 0.24, R * 0.8, R * 0.08);
        ctx.strokeStyle = "#c8cfdb"; ctx.lineWidth = Math.max(2, cell * 0.06); // carry handle
        ctx.beginPath(); ctx.arc(sx, sy - R * 0.46, R * 0.34, Math.PI, 0); ctx.stroke();
        ctx.fillStyle = frac <= 0.33 ? "#ffd0d0" : "#ffe9a8"; // eyes, glaring when enraged
        ctx.beginPath(); ctx.arc(sx - R * 0.26, sy + R * 0.06, R * 0.11, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.arc(sx + R * 0.26, sy + R * 0.06, R * 0.11, 0, 7); ctx.fill();
        bossCrown(sx, sy - R * 0.78, R);
      } else {
        // Sock Goblin: a cream sock with a folded cuff, a toe, and a cheeky face
        shadow(sx, sy + cell * 0.34, r * 0.72, r * 0.24);
        ctx.save();
        ctx.translate(sx, sy); ctx.rotate(-0.18);
        // leg + foot as one rounded silhouette
        ctx.fillStyle = "#eef1f8";
        ctx.beginPath();
        ctx.moveTo(-r * 0.42, -r * 0.7);
        ctx.lineTo(r * 0.36, -r * 0.7);
        ctx.quadraticCurveTo(r * 0.52, -r * 0.7, r * 0.52, -r * 0.2);
        ctx.lineTo(r * 0.52, r * 0.2);
        ctx.quadraticCurveTo(r * 0.52, r * 0.5, r * 0.9, r * 0.52); // heel/toe kick
        ctx.quadraticCurveTo(r * 1.12, r * 0.56, r * 1.12, r * 0.9);
        ctx.quadraticCurveTo(r * 1.12, r * 1.16, r * 0.72, r * 1.16);
        ctx.lineTo(-r * 0.42, r * 1.16);
        ctx.quadraticCurveTo(-r * 0.64, r * 1.16, -r * 0.64, r * 0.7);
        ctx.lineTo(-r * 0.64, -r * 0.4);
        ctx.quadraticCurveTo(-r * 0.64, -r * 0.7, -r * 0.42, -r * 0.7);
        ctx.closePath(); ctx.fill();
        // soft shade on the underside
        ctx.fillStyle = "rgba(160,175,205,0.4)";
        ctx.beginPath(); ctx.ellipse(r * 0.55, r * 0.95, r * 0.5, r * 0.22, 0, 0, 7); ctx.fill();
        // folded cuff (colored band)
        ctx.fillStyle = "#e2626b";
        ctx.beginPath(); ctx.rect(-r * 0.64, -r * 0.7, r * 1.16, r * 0.34); ctx.fill();
        ctx.fillStyle = "#c94a54";
        ctx.beginPath(); ctx.rect(-r * 0.64, -r * 0.44, r * 1.16, r * 0.08); ctx.fill();
        ctx.restore();
        // face (upright, not rotated with the sock)
        ctx.fillStyle = "#22304a";
        ctx.beginPath(); ctx.arc(sx - r * 0.16, sy + r * 0.02, r * 0.1, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.arc(sx + r * 0.14, sy + r * 0.02, r * 0.1, 0, 7); ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.beginPath(); ctx.arc(sx - r * 0.19, sy - r * 0.01, r * 0.035, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.arc(sx + r * 0.11, sy - r * 0.01, r * 0.035, 0, 7); ctx.fill();
        ctx.strokeStyle = "#22304a"; ctx.lineWidth = Math.max(1, cell * 0.03); ctx.lineCap = "round";
        ctx.beginPath(); ctx.arc(sx - r * 0.01, sy + r * 0.2, r * 0.14, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
      }
    }

    // ---------- towers (upright, screen space) ----------
    // Every LINE reads at a glance, and so does every TIER: a tier-2 gun must be
    // visibly a different object from the tier-1 it replaced, not the same
    // sprite with an extra dot. Each line grows along its own axis (barrels /
    // tube length + iron / blades + cage / camp size), gains a plinth at T2 and
    // an armour skirt at T3, and each of the six tier-4 BRANCHES is its own
    // silhouette so the endgame board reads as a fort of unique machines.
    function towerPlinth(x, y, u, tier) {
      if (tier < 2) return;
      ctx.fillStyle = tier >= 4 ? "#4a3f14" : "#26334f";
      ctx.beginPath(); ctx.ellipse(x, y + u * 0.3, u * (tier >= 3 ? 0.44 : 0.38), u * (tier >= 3 ? 0.17 : 0.14), 0, 0, 7); ctx.fill();
      // TIER READS OFF THE PLINTH RING, not off the pips. The pips are
      // `u * 0.045` — a 2.4px dot at the 390px phone's cell of 27, and 1.5px at
      // 320 — so the information they carry is simply not delivered at the size
      // the game is actually played. This ring is already ~24px across and
      // already stroked, so a colour ladder (bronze → silver → gold) costs
      // nothing and is legible at every cell size. Tier 1 has no plinth at all,
      // which is its own signal, so the ladder is three steps.
      ctx.strokeStyle = tier >= 4 ? "#ffd94a" : tier >= 3 ? "#c8cfdb" : "#b0754a";
      ctx.lineWidth = Math.max(1.5, u * 0.05); ctx.stroke();
      if (tier >= 3) { // bolt heads around the skirt
        ctx.fillStyle = tier >= 4 ? "#ffe9a3" : "#8fa6d0";
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          ctx.beginPath(); ctx.arc(x + Math.cos(a) * u * 0.4, y + u * 0.3 + Math.sin(a) * u * 0.14, u * 0.028, 0, 7); ctx.fill();
        }
      }
    }
    // The Fan's continuous zap. Tiers 1-3 and the Blizzard branch never emitted
    // an event (only the Static's `chain` did), so three of the four Fan variants
    // fired with NO visual at all — a 300-gold purchase that changed nothing you
    // could see. A `shoot` event would be wrong here anyway: the beam is a state,
    // not an impact, and one event per tick per fan would blow the 400-cap event
    // buffer that already ate this project's damage tallies once.
    function drawZapBeams(st) {
      for (const t of st.towers) {
        if (t.lineId !== "fan" || !t.targetId) continue;
        if (t.disabledUntil && st.tick < t.disabledUntil) continue;   // a jammed gun fires nothing
        const target = st.enemies.find((x) => x.alive && x.id === t.targetId);
        if (!target) continue;
        const a = worldToScreen(t.cx + 0.5, t.cy + 0.5);
        const tp = engine.posOn(target.pathIdx, target.dist);
        const b = worldToScreen(tp.x + 0.5, tp.y + 0.5);
        // A jagged arc, deterministic off the tick so it crackles without rng.
        const seg = 5, jag = cell * 0.12;
        ctx.save();
        ctx.lineCap = "round"; ctx.lineJoin = "round";
        for (const pass of [{ w: 0.20, c: "rgba(150,225,255,0.30)" }, { w: 0.075, c: "rgba(235,250,255,0.95)" }]) {
          ctx.strokeStyle = pass.c; ctx.lineWidth = Math.max(1, cell * pass.w);
          ctx.beginPath(); ctx.moveTo(a.x, a.y);
          for (let i = 1; i < seg; i++) {
            const f = i / seg;
            const nx = -(b.y - a.y), ny = b.x - a.x, nl = Math.hypot(nx, ny) || 1;
            const wob = Math.sin(st.tick * 0.9 + i * 2.1 + t.id) * jag * (1 - Math.abs(f - 0.5) * 2);
            ctx.lineTo(a.x + (b.x - a.x) * f + (nx / nl) * wob, a.y + (b.y - a.y) * f + (ny / nl) * wob);
          }
          ctx.lineTo(b.x, b.y); ctx.stroke();
        }
        const gl = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, cell * 0.4);
        gl.addColorStop(0, "rgba(210,245,255,0.55)"); gl.addColorStop(1, "rgba(210,245,255,0)");
        ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(b.x, b.y, cell * 0.4, 0, 7); ctx.fill();
        ctx.restore();
      }
    }

    function drawTower(t) {
      const p = worldToScreen(t.cx + 0.5, t.cy + 0.5);
      const x = p.x, y = p.y, u = cell;
      const tier = t.tier, br = tier >= 4 ? t.branch : "";
      // ⚡ Overclock reads on the TOWER's own ring — hot while boosted, cold
      // while it is paying the crash back. Deliberately not a full-field tint:
      // stacking translucent overlays is a defect this project already shipped
      // once (a burst of leak flashes piled into an opaque red wall).
      const tick = engine.state.tick;
      if (t.boostUntil && tick < t.boostUntil) {
        const g = 0.35 + 0.2 * Math.sin(tick / 3 + t.id);
        ctx.strokeStyle = "rgba(255,214,80," + g.toFixed(2) + ")"; ctx.lineWidth = Math.max(2, u * 0.07);
        ctx.beginPath(); ctx.arc(x, y, u * 0.46, 0, 7); ctx.stroke();
      } else if (t.crashUntil && tick < t.crashUntil) {
        ctx.strokeStyle = "rgba(120,150,190,0.5)"; ctx.lineWidth = Math.max(2, u * 0.05);
        ctx.beginPath(); ctx.arc(x, y, u * 0.44, 0, 7); ctx.stroke();
        // a small drooping arc so "resting" reads even in a still frame
        ctx.strokeStyle = "rgba(150,175,205,0.75)"; ctx.lineWidth = Math.max(1, u * 0.045);
        ctx.beginPath(); ctx.arc(x, y - u * 0.02, u * 0.28, 0.5, Math.PI - 0.5); ctx.stroke();
      }
      shadow(x, y + u * 0.36, u * 0.4, u * 0.16);
      towerPlinth(x, y, u, tier);
      if (t.lineId === "dart") {
        // Pea Shooter → Double Dart → Triple Threat → Sniper Scope / Minigun.
        // Growth axis: barrel COUNT, then a scope, then the branch silhouette.
        const domeR = br === "a" ? 0.3 : br === "b" ? 0.33 : 0.25 + tier * 0.026;
        if (br === "a") {
          // Sniper: ONE long heavy barrel, bipod legs, a big scope on top.
          ctx.strokeStyle = "#14452c"; ctx.lineWidth = Math.max(2, u * 0.07); ctx.lineCap = "round";
          ctx.beginPath(); ctx.moveTo(x - u * 0.16, y + u * 0.1); ctx.lineTo(x - u * 0.3, y + u * 0.3); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(x + u * 0.16, y + u * 0.1); ctx.lineTo(x + u * 0.3, y + u * 0.3); ctx.stroke();
          ctx.strokeStyle = "#123c26"; ctx.lineWidth = Math.max(4, u * 0.17);
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - u * 0.72); ctx.stroke();
          ctx.strokeStyle = "#2f7d3f"; ctx.lineWidth = Math.max(2, u * 0.09);
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - u * 0.7); ctx.stroke();
          ctx.fillStyle = "#ffd94a"; // muzzle brake
          ctx.beginPath(); ctx.rect(x - u * 0.11, y - u * 0.78, u * 0.22, u * 0.1); ctx.fill();
        } else if (br === "b") {
          // Minigun: a spinning 5-barrel cluster + an ammo drum.
          const spin = engine.state.tick * 0.35 + t.id;
          ctx.fillStyle = "#1c5c3a";
          ctx.beginPath(); ctx.ellipse(x + u * 0.3, y + u * 0.06, u * 0.16, u * 0.2, 0, 0, 7); ctx.fill();
          ctx.strokeStyle = "#123c26"; ctx.lineWidth = Math.max(2, u * 0.08); ctx.lineCap = "round";
          for (let i = 0; i < 5; i++) {
            const off = Math.cos(spin + (i * Math.PI * 2) / 5) * u * 0.13;
            ctx.beginPath(); ctx.moveTo(x + off, y - u * 0.1); ctx.lineTo(x + off, y - u * 0.56); ctx.stroke();
          }
          ctx.fillStyle = "#ffd94a";
          ctx.beginPath(); ctx.arc(x, y - u * 0.58, u * 0.09, 0, 7); ctx.fill();
        } else {
          const barrels = tier;
          ctx.strokeStyle = "#1c5c3a"; ctx.lineWidth = Math.max(3, u * (0.1 + tier * 0.015)); ctx.lineCap = "round";
          const reach = 0.4 + tier * 0.045;
          for (let i = 0; i < barrels; i++) {
            const a = -Math.PI / 2 + (i - (barrels - 1) / 2) * 0.42;
            ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * u * reach, y + Math.sin(a) * u * reach); ctx.stroke();
          }
          ctx.fillStyle = tier >= 3 ? "#ffd94a" : "#2f7d3f";
          for (let i = 0; i < barrels; i++) {
            const a = -Math.PI / 2 + (i - (barrels - 1) / 2) * 0.42;
            ctx.beginPath(); ctx.arc(x + Math.cos(a) * u * reach, y + Math.sin(a) * u * reach, u * 0.07, 0, 7); ctx.fill();
          }
        }
        const gd = ctx.createRadialGradient(x - u * 0.12, y - u * 0.12, u * 0.05, x, y, u * 0.32);
        gd.addColorStop(0, br ? "#8ff0b4" : "#63d38f"); gd.addColorStop(1, br ? "#1f8f52" : "#2fa562");
        ctx.fillStyle = gd; ctx.beginPath(); ctx.arc(x, y, u * domeR, 0, 7); ctx.fill();
        ctx.strokeStyle = "#1c5c3a"; ctx.lineWidth = Math.max(1.5, u * 0.05); ctx.stroke();
        if (tier >= 3) { // armour collar bolted round the dome
          ctx.strokeStyle = "#8fa6d0"; ctx.lineWidth = Math.max(1.5, u * 0.045);
          ctx.beginPath(); ctx.arc(x, y, u * (domeR + 0.06), 0.15, Math.PI - 0.15); ctx.stroke();
        }
        if (tier >= 3 || br) { // scope
          ctx.fillStyle = "#12203a";
          ctx.beginPath(); ctx.rect(x - u * (br === "a" ? 0.2 : 0.14), y - u * 0.34, u * (br === "a" ? 0.4 : 0.28), u * 0.12); ctx.fill();
          ctx.fillStyle = "#7fe3ff";
          ctx.beginPath(); ctx.arc(x + u * (br === "a" ? 0.16 : 0.11), y - u * 0.28, u * 0.045, 0, 7); ctx.fill();
        }
        ctx.fillStyle = "rgba(255,255,255,0.55)";
        ctx.beginPath(); ctx.arc(x - u * 0.1, y - u * 0.1, u * 0.07, 0, 7); ctx.fill();
      } else if (t.lineId === "mortar") {
        // Block Lobber → Brick Cannon → Crate Cannon → Big Bertha / Sticky Bomb.
        // Growth axis: tube LENGTH + calibre, iron bands, then the branch.
        const len = br ? 0.62 : 0.3 + tier * 0.06;
        const bore = br === "a" ? 0.3 : br === "b" ? 0.26 : 0.14 + tier * 0.03;
        const ang = -Math.PI / 3; // up-right
        const mx = x + Math.cos(ang) * u * len, my = y + Math.sin(ang) * u * len;
        ctx.strokeStyle = br === "b" ? "#7a5a12" : "#4a3118";
        ctx.lineWidth = Math.max(4, u * (bore + 0.06)); ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(x - u * 0.06, y + u * 0.06); ctx.lineTo(mx, my); ctx.stroke();
        ctx.strokeStyle = br === "b" ? "#d69a2a" : br === "a" ? "#8c7a5e" : "#5f4022";
        ctx.lineWidth = Math.max(2, u * bore);
        ctx.beginPath(); ctx.moveTo(x - u * 0.06, y + u * 0.06); ctx.lineTo(mx, my); ctx.stroke();
        if (tier >= 2) { // iron bands along the tube
          ctx.strokeStyle = "#9aa6bd"; ctx.lineWidth = Math.max(1.5, u * 0.045);
          for (let i = 1; i <= (tier >= 3 ? 3 : 2); i++) {
            const f = i / ((tier >= 3 ? 3 : 2) + 1);
            const bx = x - u * 0.06 + (mx - (x - u * 0.06)) * f, by = y + u * 0.06 + (my - (y + u * 0.06)) * f;
            ctx.beginPath(); ctx.arc(bx, by, u * (bore * 0.6 + 0.03), 0, 7); ctx.stroke();
          }
        }
        ctx.fillStyle = "#2b1c0e";
        ctx.beginPath(); ctx.arc(mx, my, u * (bore * 0.7 + 0.04), 0, 7); ctx.fill();
        if (br === "a") { // Bertha: a vented muzzle brake + gold trim
          ctx.strokeStyle = "#ffd94a"; ctx.lineWidth = Math.max(2, u * 0.06);
          ctx.beginPath(); ctx.arc(mx, my, u * 0.22, 0, 7); ctx.stroke();
          ctx.strokeStyle = "#12203a"; ctx.lineWidth = Math.max(1.5, u * 0.05);
          for (let k = -1; k <= 1; k += 2) {
            ctx.beginPath(); ctx.moveTo(mx + k * u * 0.16, my - u * 0.1); ctx.lineTo(mx + k * u * 0.24, my - u * 0.02); ctx.stroke();
          }
        }
        if (br === "b") { // Sticky: honey drips off the muzzle
          ctx.fillStyle = "#ffcf4d";
          for (let k = 0; k < 3; k++) {
            const dy = ((engine.state.tick * 0.6 + k * 9) % 18) / 18;
            ctx.beginPath(); ctx.ellipse(mx - u * 0.05 + k * u * 0.06, my + u * (0.1 + dy * 0.3), u * 0.045, u * 0.06, 0, 0, 7); ctx.fill();
          }
        }
        const gm = ctx.createRadialGradient(x - u * 0.12, y - u * 0.1, u * 0.06, x, y, u * 0.34);
        if (br === "b") { gm.addColorStop(0, "#ffd76a"); gm.addColorStop(1, "#b8801c"); }
        else { gm.addColorStop(0, br === "a" ? "#c9c1b0" : "#b07c48"); gm.addColorStop(1, br === "a" ? "#6d6455" : "#7a5230"); }
        ctx.fillStyle = gm; ctx.beginPath(); ctx.arc(x, y, u * (0.28 + tier * 0.014), 0, 7); ctx.fill();
        ctx.strokeStyle = "#4a3118"; ctx.lineWidth = Math.max(1.5, u * 0.05); ctx.stroke();
        if (tier >= 3) { // ammo crate beside the breech
          ctx.fillStyle = "#8a5f32";
          ctx.beginPath(); ctx.rect(x - u * 0.42, y + u * 0.06, u * 0.2, u * 0.18); ctx.fill();
          ctx.strokeStyle = "#5f4022"; ctx.lineWidth = Math.max(1, u * 0.03); ctx.stroke();
        }
        ctx.fillStyle = "rgba(255,255,255,0.35)";
        ctx.beginPath(); ctx.arc(x - u * 0.1, y - u * 0.08, u * 0.07, 0, 7); ctx.fill();
      } else if (t.lineId === "fan") {
        // Cool Breeze → Chill Wind → Freezer Blast → Blizzard Cone / Static Zap.
        // Growth axis: blade COUNT + a guard cage, then the branch.
        const gf = ctx.createRadialGradient(x, y, u * 0.05, x, y, u * 0.34);
        gf.addColorStop(0, br === "b" ? "#8c6ad6" : "#2a8fb0"); gf.addColorStop(1, br === "b" ? "#5b3fa0" : "#1f6e8c");
        ctx.fillStyle = gf; ctx.beginPath(); ctx.arc(x, y, u * (0.26 + tier * 0.014), 0, 7); ctx.fill();
        if (br === "b") {
          // Static Zap: a tesla coil — copper windings and live arcs, no blades.
          ctx.strokeStyle = "#d98b4a"; ctx.lineWidth = Math.max(1.5, u * 0.05);
          for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.ellipse(x, y - u * (0.12 + i * 0.1), u * (0.2 - i * 0.03), u * 0.05, 0, 0, 7); ctx.stroke(); }
          ctx.fillStyle = "#e9dcff"; ctx.beginPath(); ctx.arc(x, y - u * 0.52, u * 0.11, 0, 7); ctx.fill();
          ctx.strokeStyle = "rgba(200,170,255,0.95)"; ctx.lineWidth = Math.max(1, u * 0.035); ctx.lineCap = "round";
          for (let k = 0; k < 3; k++) {
            const a = engine.state.tick * 0.5 + k * 2.1;
            ctx.beginPath(); ctx.moveTo(x, y - u * 0.52);
            ctx.lineTo(x + Math.cos(a) * u * 0.2, y - u * 0.52 + Math.sin(a) * u * 0.2);
            ctx.stroke();
          }
        } else {
          const blades = br === "a" ? 6 : 2 + tier;
          const spin = engine.state.tick * (br ? 0.24 : 0.14) + t.id;
          const reach = br === "a" ? 0.42 : 0.3 + tier * 0.014;
          for (let i = 0; i < blades; i++) {
            const a = spin + (i * Math.PI * 2) / blades;
            ctx.save(); ctx.translate(x, y); ctx.rotate(a);
            const gb = ctx.createLinearGradient(0, 0, u * reach, 0);
            gb.addColorStop(0, "rgba(232,247,255,0.95)"); gb.addColorStop(1, "rgba(126,220,255,0.35)");
            ctx.fillStyle = gb;
            ctx.beginPath(); ctx.moveTo(0, 0);
            ctx.quadraticCurveTo(u * reach * 0.82, -u * 0.14, u * (reach + 0.04), u * 0.02);
            ctx.quadraticCurveTo(u * reach * 0.76, u * 0.08, 0, 0); ctx.fill();
            ctx.restore();
          }
          if (tier >= 2) { // guard cage
            ctx.strokeStyle = "rgba(180,225,245,0.7)"; ctx.lineWidth = Math.max(1, u * 0.03);
            ctx.beginPath(); ctx.arc(x, y, u * (reach + 0.06), 0, 7); ctx.stroke();
          }
          if (tier >= 3) { // frost crystals at the compass points
            ctx.fillStyle = "#dff4ff";
            for (let i = 0; i < 4; i++) {
              const a = (i / 4) * Math.PI * 2 + 0.4;
              ctx.beginPath();
              ctx.arc(x + Math.cos(a) * u * (reach + 0.06), y + Math.sin(a) * u * (reach + 0.06), u * 0.05, 0, 7);
              ctx.fill();
            }
          }
          if (br === "a") { // Blizzard: a swirling snow ring
            ctx.fillStyle = "rgba(230,248,255,0.85)";
            for (let k = 0; k < 6; k++) {
              const a = -spin * 0.6 + (k / 6) * Math.PI * 2;
              ctx.beginPath(); ctx.arc(x + Math.cos(a) * u * 0.56, y + Math.sin(a) * u * 0.56, u * 0.05, 0, 7); ctx.fill();
            }
          }
        }
        ctx.fillStyle = "#eaf8ff"; ctx.beginPath(); ctx.arc(x, y, u * 0.08, 0, 7); ctx.fill();
        ctx.fillStyle = br === "b" ? "#5b3fa0" : "#1f6e8c"; ctx.beginPath(); ctx.arc(x, y, u * 0.04, 0, 7); ctx.fill();
      } else if (t.lineId === "camp") {
        // Squad Tent → Barracks → Elite Platoon → Dino Squad / RC Racers.
        // Growth axis: camp SIZE + defences, then the branch's own outpost.
        const w = 0.3 + tier * 0.03, h = 0.28 + tier * 0.03;
        ctx.fillStyle = "rgba(0,0,0,0.18)";
        ctx.beginPath(); ctx.ellipse(x, y + u * 0.3, u * 0.42, u * 0.14, 0, 0, 7); ctx.fill();
        const roof = br === "a" ? "#4f8b3a" : br === "b" ? "#3f5f8b" : "#3c7a45";
        const roofDk = br === "a" ? "#3d6f2c" : br === "b" ? "#2f4a70" : "#2f6438";
        ctx.fillStyle = roof;
        ctx.beginPath();
        ctx.moveTo(x - u * w, y + u * 0.28); ctx.lineTo(x, y - u * h); ctx.lineTo(x + u * w, y + u * 0.28);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = roofDk;
        ctx.beginPath();
        ctx.moveTo(x, y - u * h); ctx.lineTo(x + u * w, y + u * 0.28); ctx.lineTo(x + u * 0.08, y + u * 0.28);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = "#23502e";
        ctx.beginPath();
        ctx.moveTo(x - u * 0.12, y + u * 0.28); ctx.lineTo(x, y - u * 0.02); ctx.lineTo(x + u * 0.12, y + u * 0.28);
        ctx.closePath(); ctx.fill();
        if (br === "a") { // Dino Squad: scale ridge along the roof + a bone banner
          ctx.fillStyle = "#c9f06a";
          for (let i = 0; i < 4; i++) {
            const f = 0.15 + i * 0.2;
            ctx.beginPath();
            ctx.moveTo(x - u * w * (1 - f), y + u * 0.28 - u * (h + 0.28) * f);
            ctx.lineTo(x - u * w * (1 - f) - u * 0.09, y + u * 0.28 - u * (h + 0.28) * f - u * 0.05);
            ctx.lineTo(x - u * w * (1 - f), y + u * 0.28 - u * (h + 0.28) * f - u * 0.12);
            ctx.closePath(); ctx.fill();
          }
        }
        if (br === "b") { // RC Racers: an antenna + a tiny car in the pit lane
          ctx.strokeStyle = "#cfe2ff"; ctx.lineWidth = Math.max(1, u * 0.03); ctx.lineCap = "round";
          ctx.beginPath(); ctx.moveTo(x + u * 0.22, y - u * 0.1); ctx.lineTo(x + u * 0.34, y - u * 0.52); ctx.stroke();
          ctx.fillStyle = "#ff6f6f"; ctx.beginPath(); ctx.arc(x + u * 0.34, y - u * 0.54, u * 0.05, 0, 7); ctx.fill();
          ctx.fillStyle = "#e2626b";
          ctx.beginPath(); ctx.rect(x - u * 0.4, y + u * 0.14, u * 0.2, u * 0.1); ctx.fill();
          ctx.fillStyle = "#22304a";
          ctx.beginPath(); ctx.arc(x - u * 0.35, y + u * 0.25, u * 0.05, 0, 7); ctx.fill();
          ctx.beginPath(); ctx.arc(x - u * 0.24, y + u * 0.25, u * 0.05, 0, 7); ctx.fill();
        }
        ctx.strokeStyle = "#caa268"; ctx.lineWidth = Math.max(1.5, u * 0.05); // pole
        ctx.beginPath(); ctx.moveTo(x, y - u * h); ctx.lineTo(x, y - u * (h + 0.22)); ctx.stroke();
        ctx.fillStyle = br === "a" ? "#c9f06a" : br === "b" ? "#eaf2ff" : "#e2626b"; // flag (checkered for RC)
        ctx.beginPath(); ctx.moveTo(x, y - u * (h + 0.22)); ctx.lineTo(x + u * 0.2, y - u * (h + 0.16)); ctx.lineTo(x, y - u * (h + 0.08)); ctx.closePath(); ctx.fill();
        if (br === "b") { ctx.fillStyle = "#22304a"; ctx.beginPath(); ctx.rect(x + u * 0.05, y - u * (h + 0.2), u * 0.06, u * 0.06); ctx.fill(); }
        // sandbags: more of them as the camp grows
        ctx.fillStyle = "#9c7a52";
        const bags = 1 + tier;
        for (let i = 0; i < bags; i++) {
          const off = (i - (bags - 1) / 2) * u * 0.19;
          ctx.beginPath(); ctx.ellipse(x + off, y + u * 0.28, u * 0.11, u * 0.07, 0, 0, 7); ctx.fill();
        }
        if (tier >= 3) { // a lookout post on the left
          ctx.fillStyle = "#6b4f2c";
          ctx.beginPath(); ctx.rect(x - u * 0.46, y - u * 0.16, u * 0.12, u * 0.44); ctx.fill();
          ctx.fillStyle = "#8a6a3c";
          ctx.beginPath(); ctx.rect(x - u * 0.52, y - u * 0.28, u * 0.24, u * 0.14); ctx.fill();
        }
      }
      // tier pips — a tier-4 branch gets a crown instead of a fourth dot
      if (tier >= 4) {
        ctx.fillStyle = "#ffd94a";
        ctx.beginPath();
        ctx.moveTo(x - u * 0.16, y + u * 0.46); ctx.lineTo(x - u * 0.16, y + u * 0.38);
        ctx.lineTo(x - u * 0.06, y + u * 0.44); ctx.lineTo(x, y + u * 0.34);
        ctx.lineTo(x + u * 0.06, y + u * 0.44); ctx.lineTo(x + u * 0.16, y + u * 0.38);
        ctx.lineTo(x + u * 0.16, y + u * 0.46);
        ctx.closePath(); ctx.fill();
      } else {
        // Tier now reads off the plinth's colour ladder (see towerPlinth); these
        // stay as a secondary cue, but bigger and fewer so they are visible at
        // all rather than three 2.4px specks 3.8px apart.
        ctx.fillStyle = "#ffe27a";
        for (let i = 0; i < tier - 1; i++) {
          ctx.beginPath(); ctx.arc(x - u * 0.09 + i * u * 0.18, y + u * 0.44, u * 0.07, 0, 7); ctx.fill();
        }
      }
      // jammed by The Static: a pulsing red crackle so the player sees the gun is down
      if (t.disabledUntil && engine.state.tick < t.disabledUntil) {
        const pu = 0.5 + 0.5 * Math.sin(engine.state.tick / 3);
        ctx.strokeStyle = "rgba(255,110,110," + (0.5 + 0.4 * pu).toFixed(2) + ")"; ctx.lineWidth = Math.max(2, u * 0.07);
        ctx.beginPath(); ctx.arc(x, y, u * 0.44, 0, 7); ctx.stroke();
        ctx.strokeStyle = "rgba(255,220,120,0.9)"; ctx.lineWidth = Math.max(1.5, u * 0.045); ctx.lineCap = "round";
        for (let k = 0; k < 3; k++) { const a = engine.state.tick * 0.4 + k * 2.1; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * u * 0.42, y + Math.sin(a) * u * 0.42 - u * 0.1); ctx.stroke(); }
      }
    }

    // ---------- soldiers (upright, screen space) ----------
    function drawSoldier(s) {
      // Soldier posts come from posAt(), the same corner-based space as enemies —
      // which the enemy pass shifts by +0.5. Without it the squad drew half a
      // cell off the lane, so the "visible wall" never stood on the road.
      const p = worldToScreen(s.x + 0.5, s.y + 0.5);
      const x = p.x, y = p.y, u = cell;
      // A squad must SHOW its camp's rank: every soldier used to draw as the same
      // tier-1 grunt, so upgrading a camp — and especially taking Dino Squad or
      // RC Racers — changed nothing you could see on the field.
      const camp = engine.state.towers.find((t) => t.id === s.campId);
      const tier = camp ? camp.tier : 1, br = camp && camp.tier >= 4 ? camp.branch : "";
      shadow(x, y + u * 0.24, u * 0.2, u * 0.09);
      if (br === "a") { // Dino Squad: a stout little dinosaur with a spine ridge
        ctx.fillStyle = "#2f6a38";
        ctx.beginPath(); ctx.ellipse(x, y + u * 0.22, u * 0.18, u * 0.06, 0, 0, 7); ctx.fill();
        ctx.fillStyle = "#6cc24a";
        ctx.beginPath(); ctx.ellipse(x - u * 0.02, y + u * 0.04, u * 0.17, u * 0.14, 0, 0, 7); ctx.fill();
        ctx.beginPath(); // tail
        ctx.moveTo(x - u * 0.14, y + u * 0.06); ctx.quadraticCurveTo(x - u * 0.32, y + u * 0.02, x - u * 0.3, y + u * 0.18);
        ctx.quadraticCurveTo(x - u * 0.2, y + u * 0.12, x - u * 0.12, y + u * 0.14); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.arc(x + u * 0.13, y - u * 0.11, u * 0.11, 0, 7); ctx.fill(); // head
        ctx.fillStyle = "#4e9c33"; // legs
        ctx.beginPath(); ctx.rect(x - u * 0.09, y + u * 0.13, u * 0.07, u * 0.1); ctx.fill();
        ctx.beginPath(); ctx.rect(x + u * 0.04, y + u * 0.13, u * 0.07, u * 0.1); ctx.fill();
        ctx.fillStyle = "#c9f06a"; // spines
        for (let k = 0; k < 3; k++) {
          ctx.beginPath();
          ctx.moveTo(x - u * (0.06 - k * 0.06), y - u * 0.06);
          ctx.lineTo(x - u * (0.02 - k * 0.06), y - u * 0.18);
          ctx.lineTo(x + u * (0.02 + k * 0.06), y - u * 0.06);
          ctx.closePath(); ctx.fill();
        }
        ctx.fillStyle = "#22304a";
        ctx.beginPath(); ctx.arc(x + u * 0.17, y - u * 0.14, u * 0.028, 0, 7); ctx.fill();
        ctx.fillStyle = "#fff"; // teeth
        ctx.beginPath(); ctx.moveTo(x + u * 0.2, y - u * 0.05); ctx.lineTo(x + u * 0.23, y - u * 0.005); ctx.lineTo(x + u * 0.16, y - u * 0.03); ctx.closePath(); ctx.fill();
      } else if (br === "b") { // RC Racers: a tiny radio-controlled car
        ctx.fillStyle = "#22304a";
        ctx.beginPath(); ctx.ellipse(x, y + u * 0.2, u * 0.18, u * 0.05, 0, 0, 7); ctx.fill();
        ctx.fillStyle = "#e2626b";
        ctx.beginPath(); ctx.rect(x - u * 0.19, y + u * 0.02, u * 0.38, u * 0.13); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(x - u * 0.1, y + u * 0.02); ctx.lineTo(x - u * 0.05, y - u * 0.1);
        ctx.lineTo(x + u * 0.08, y - u * 0.1); ctx.lineTo(x + u * 0.13, y + u * 0.02);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = "#7fe3ff";
        ctx.beginPath(); ctx.rect(x - u * 0.05, y - u * 0.08, u * 0.11, u * 0.07); ctx.fill();
        ctx.fillStyle = "#12203a"; // wheels
        ctx.beginPath(); ctx.arc(x - u * 0.13, y + u * 0.17, u * 0.075, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.arc(x + u * 0.13, y + u * 0.17, u * 0.075, 0, 7); ctx.fill();
        ctx.fillStyle = "#8fa6d0";
        ctx.beginPath(); ctx.arc(x - u * 0.13, y + u * 0.17, u * 0.03, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.arc(x + u * 0.13, y + u * 0.17, u * 0.03, 0, 7); ctx.fill();
        ctx.strokeStyle = "#cfe2ff"; ctx.lineWidth = Math.max(1, u * 0.025); ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(x + u * 0.16, y - u * 0.02); ctx.lineTo(x + u * 0.22, y - u * 0.26); ctx.stroke();
        ctx.fillStyle = "#ffd94a";
        ctx.beginPath(); ctx.arc(x + u * 0.22, y - u * 0.28, u * 0.035, 0, 7); ctx.fill();
      } else {
        // Army guy — darker fatigues and better kit as the camp ranks up.
        const body = tier >= 3 ? "#3f7a46" : tier === 2 ? "#458c4e" : "#4c9a55";
        const hat = tier >= 3 ? "#2c5c33" : tier === 2 ? "#356b3c" : "#3f8248";
        ctx.fillStyle = "#2f6a38";
        ctx.beginPath(); ctx.ellipse(x, y + u * 0.22, u * 0.16, u * 0.06, 0, 0, 7); ctx.fill(); // base
        ctx.fillStyle = body;
        ctx.beginPath();
        ctx.moveTo(x - u * 0.12, y + u * 0.2);
        ctx.quadraticCurveTo(x - u * 0.14, y - u * 0.06, x - u * 0.08, y - u * 0.1);
        ctx.lineTo(x + u * 0.08, y - u * 0.1);
        ctx.quadraticCurveTo(x + u * 0.14, y - u * 0.06, x + u * 0.12, y + u * 0.2);
        ctx.closePath(); ctx.fill();
        if (tier >= 3) { // flak vest + shoulder pads
          ctx.fillStyle = "#6d7c58";
          ctx.beginPath(); ctx.rect(x - u * 0.1, y - u * 0.06, u * 0.2, u * 0.14); ctx.fill();
          ctx.beginPath(); ctx.ellipse(x - u * 0.12, y - u * 0.06, u * 0.05, u * 0.035, 0, 0, 7); ctx.fill();
          ctx.beginPath(); ctx.ellipse(x + u * 0.12, y - u * 0.06, u * 0.05, u * 0.035, 0, 0, 7); ctx.fill();
        }
        // rifle — longer and heavier with rank
        ctx.strokeStyle = "#274a2c"; ctx.lineWidth = Math.max(1.5, u * (0.04 + tier * 0.012)); ctx.lineCap = "round";
        const gunReach = 0.18 + tier * 0.025;
        ctx.beginPath(); ctx.moveTo(x + u * 0.02, y + u * 0.04); ctx.lineTo(x + u * gunReach, y - u * 0.12); ctx.stroke();
        // head + helmet
        ctx.fillStyle = "#e9c39a";
        ctx.beginPath(); ctx.arc(x, y - u * 0.16, u * 0.085, 0, 7); ctx.fill();
        ctx.fillStyle = hat;
        ctx.beginPath(); ctx.arc(x, y - u * 0.19, u * 0.1, Math.PI, 0); ctx.fill();
        ctx.fillRect(x - u * 0.12, y - u * 0.2, u * 0.24, u * 0.03);
        if (tier >= 2) { // rank chevrons on the chest
          ctx.fillStyle = "#ffd94a";
          for (let k = 0; k < tier - 1; k++) {
            ctx.beginPath();
            ctx.moveTo(x - u * 0.06, y + u * 0.04 + k * u * 0.05);
            ctx.lineTo(x, y + u * 0.01 + k * u * 0.05);
            ctx.lineTo(x + u * 0.06, y + u * 0.04 + k * u * 0.05);
            ctx.lineTo(x, y + u * 0.03 + k * u * 0.05);
            ctx.closePath(); ctx.fill();
          }
        }
        ctx.fillStyle = "rgba(255,255,255,0.35)";
        ctx.beginPath(); ctx.arc(x - u * 0.04, y - u * 0.22, u * 0.03, 0, 7); ctx.fill();
      }
      if (s.hp < s.maxHp) {
        const w = u * 0.42, frac = Math.max(0, s.hp / s.maxHp);
        ctx.fillStyle = "rgba(0,0,0,0.45)"; ctx.fillRect(x - w / 2, y - u * 0.38, w, 3);
        ctx.fillStyle = frac > 0.5 ? "#69d06a" : "#f0b040"; ctx.fillRect(x - w / 2, y - u * 0.38, w * frac, 3);
      }
    }

    function drawRange(cx, cy, range, ok) {
      ctx.fillStyle = ok ? "rgba(110,200,255,0.10)" : "rgba(255,120,120,0.10)";
      ctx.strokeStyle = ok ? "rgba(110,200,255,0.55)" : "rgba(255,120,120,0.55)";
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc((cx + 0.5) * cell, (cy + 0.5) * cell, range * cell, 0, 7);
      ctx.fill(); ctx.stroke();
    }

    // EVERY fx coordinate is stored in SPRITE space (cell centres), because that
    // is what drawWorldFx/drawScreenFx paint in. Engine coordinates — both grid
    // cells and path positions — are corner-based, so they need exactly one
    // +0.5. Only the grid-sourced pushes used to do it, so every fx sourced from
    // an ENEMY (poof, damage number, splash, stomp, death stars, +gold, stun,
    // rally ring, the suck beam, the leak toll) painted half a cell up-left of
    // the thing it belonged to. One helper now applies the shift once.
    const fxAt = (o, x, y) => { o.x = x + 0.5; o.y = y + 0.5; return o; };
    // where the last draw actually put the spawn/exit markers, in cell-index
    // space — the leverInfo/doorInfo precedent, so a test reads the RENDERER's
    // own numbers instead of recomputing them from the level data and proving
    // nothing.
    const markers = { spawn: null, exit: null, spawnW: 0, exitW: 0 };
    // WHERE A GLYPH'S INK SITS inside its box, measured from PIXELS.
    // textAlign/textBaseline centre the glyph's METRICS, and an emoji's ink
    // frequently sits off-centre inside them — the bed's pillow pushes it
    // sideways — so the marker looked shifted off the lane even with its anchor
    // exactly on the centre-line.
    //   The first fix corrected by measureText's actualBoundingBox* fields. It
    // measured right in headless Chromium, and a photo of the real iPad still
    // showed the bed hanging over the kerb — so those metrics cannot be trusted
    // here (WebKit has reported them relative to the text origin rather than the
    // alignment point, which would push the glyph the WRONG way). Rendering the
    // glyph once and scanning its pixels cannot be engine-dependent. Cached per
    // glyph+size, so it is a handful of small draws for a whole run.
    const inkCache = new Map();
    function inkBox(ch, px) {
      const key = ch + "|" + px;
      const hit = inkCache.get(key);
      if (hit) return hit;
      const S = Math.max(8, Math.ceil(px * 2));
      const c = document.createElement("canvas");
      c.width = S; c.height = S;
      const g = c.getContext("2d", { willReadFrequently: true });
      g.font = px + "px sans-serif";
      g.textAlign = "center"; g.textBaseline = "middle";
      g.fillStyle = "#fff";
      g.fillText(ch, S / 2, S / 2);
      let x0 = S, x1 = -1, y0 = S, y1 = -1;
      const d = g.getImageData(0, 0, S, S).data;
      for (let y = 0; y < S; y++) {
        for (let x = 0; x < S; x++) {
          if (d[(y * S + x) * 4 + 3] > 12) {
            if (x < x0) x0 = x;
            if (x > x1) x1 = x;
            if (y < y0) y0 = y;
            if (y > y1) y1 = y;
          }
        }
      }
      const v = x1 < 0
        ? { dx: 0, dy: 0, w: px, h: px }
        : { dx: (x0 + x1) / 2 - S / 2, dy: (y0 + y1) / 2 - S / 2, w: x1 - x0 + 1, h: y1 - y0 + 1 };
      inkCache.set(key, v);
      return v;
    }

    // Which bodies were struck, and until when. A tick-stamped map in the
    // RENDERER, never a field on the enemy: the engine is pure and a purely
    // visual cue has no business in hashed state. Entries expire in FLASH_TICKS
    // and are pruned every frame, so it cannot grow across a run.
    const hitFlash = new Map();
    const FLASH_TICKS = 4;
    // A cap, stated rather than silent: at an endless peak dozens of bodies can
    // die in one tick, and each pop is a full sprite draw. 20 concurrent pops is
    // far more than reads as anything, and it bounds the cost.
    const MAX_POPS = 20;
    const popCount = () => fx.reduce((n, f) => n + (f.kind === "pop" ? 1 : 0), 0);
    function pushFx(e) {
      if (e.type === "hit") {
        if (e.id) {
          const t = engine.state.tick;
          hitFlash.set(e.id, t + FLASH_TICKS);
          // prune here rather than per frame: a run kills thousands of bodies,
          // and every entry is stale 4 ticks after it lands.
          if (hitFlash.size > 96) for (const [k, v] of hitFlash) if (v <= t) hitFlash.delete(k);
        }
        fx.push(fxAt({ kind: "poof", ttl: 8, max: 8 }, e.x, e.y));
        if (e.crit) triggerShake(2);
        if (showDmg && e.dmg) fx.push(fxAt({ kind: "dmgnum", ttl: 22, max: 22, text: (e.crit ? "" : "") + e.dmg, crit: !!e.crit }, e.x, e.y));
      }
      else if (e.type === "splash") { fx.push(fxAt({ kind: "boom", r: e.r, ttl: 12, max: 12 }, e.x, e.y)); triggerShake(1.5); }
      else if (e.type === "stomp") { fx.push(fxAt({ kind: "boom", r: e.r, ttl: 14, max: 14 }, e.x, e.y)); triggerShake(3.5); } // boss shockwave
      else if (e.type === "boss") triggerShake(3);
      else if (e.type === "die") {
        fx.push(fxAt({ kind: "stars", ttl: 16, max: 16 }, e.x, e.y));
        fx.push(fxAt({ kind: "gold", ttl: 26, max: 26, text: "+" + e.bounty }, e.x, e.y));
        // …and the BODY goes with it. An enemy is only ever flagged dead (it is
        // never spliced), but the draw loop skips `!alive`, so a hundred bodies a
        // wave simply blinked out of existence mid-stride. The `die` event has
        // always carried the enemy TYPE and its position, so the corpse is a pure
        // render concern: the real sprite, squashed wide and flat as it fades.
        if (e.enemy && popCount() < MAX_POPS) fx.push(fxAt({ kind: "pop", ttl: 9, max: 9, etype: e.enemy }, e.x, e.y));
      } else if (e.type === "shoot") {
        // FIRING HAD A SOUND AND NO PICTURE. The engine has always emitted
        // `shoot` and td-main has always played a tick for it, but nothing was
        // ever drawn: on a 14-tower board every gun fired continuously and the
        // muzzle showed nothing, so a projectile simply appeared out of the air.
        // A short bright flash at the barrel is the cheapest possible fix for
        // the biggest remaining hole in how the field FEELS.
        //
        // ttl 4 is deliberate. This is the single most frequent event in the
        // game — far more often than a hit, because a miss still fires — so it
        // has to expire almost immediately or the fx list grows without bound at
        // the peak. Two ops, no shake: a shake per shot would be a seizure.
        fx.push(fxAt({ kind: "muzzle", ttl: 4, max: 4, line: e.tower }, e.x, e.y));
      } else if (e.type === "build" || e.type === "upgrade") fx.push(fxAt({ kind: "ring", ttl: 12, max: 12 }, e.x, e.y));
      else if (e.type === "leak") { // a burst of leaks REFRESHES one flash — never stacks to an opaque wall
        const cost = e.lives || 1;
        const cur = fx.find((f) => f.kind === "leak");
        // A boss eating 8 stickers at once must not read as the same blink a
        // sock makes: it flashes deeper and for longer, and shakes the field.
        const ttl = e.boss ? 26 : 10, deep = e.boss ? 0.5 : 0.25;
        if (cur) { cur.ttl = Math.max(cur.ttl, ttl); cur.max = Math.max(cur.max, ttl); cur.deep = Math.max(cur.deep || 0.25, deep); }
        else fx.push({ kind: "leak", x: 0, y: 0, ttl, max: ttl, deep });
        if (cost > 1 && !e.shielded) {
          // the toll, floated at the door so you SEE what it cost
          const end = engine.posOn(0, 1e9);
          fx.push(fxAt({ kind: "toll", ttl: 34, max: 34, text: "−" + cost + " ❤️" }, end.x, end.y));
          if (e.boss) triggerShake(5);
        }
      }
      else if (e.type === "chain") fx.push({ kind: "chain", points: (e.points || []).map((q) => ({ x: q.x + 0.5, y: q.y + 0.5 })), ttl: 7, max: 7 });
      else if (e.type === "stun") fx.push(fxAt({ kind: "stars", ttl: 10, max: 10 }, e.x, e.y));
      else if (e.type === "rally") fx.push(fxAt({ kind: "ring", ttl: 10, max: 10 }, e.x, e.y));
      else if (e.type === "suck") fx.push(fxAt({ kind: "suck", sx: e.sx + 0.5, sy: e.sy + 0.5, ttl: 14, max: 14 }, e.x, e.y)); // Vacuum King inhale
      else if (e.type === "disable") fx.push(fxAt({ kind: "spark", ttl: 16, max: 16 }, e.x, e.y)); // The Static jam
      else if (e.type === "summon") fx.push(fxAt({ kind: "ring", ttl: 12, max: 12 }, e.x, e.y)); // minion pop
      // TD-9 powers had SOUND but no picture: a 130-gold Toy Box Drop damaged
      // enemies with nothing on screen to show where it landed (the "some of
      // them don't even seem to work" report). A point power now blooms at its
      // real radius, so you can see what it covered — and whether you aimed it.
      else if (e.type === "ability" && e.radius) {
        fx.push(fxAt({ kind: "boom", r: e.radius, ttl: 16, max: 16 }, e.x, e.y));
        if (e.id === "drop") triggerShake(2.5);
      }
    }

    // Speed zones. A conveyor (mult > 1) is scrolling forward chevrons; a TD-16
    // MUD PATCH (mult < 1) is the mirror image and must NOT look like one — it
    // is a stretch you WANT them walking through, so it draws as sticky ground
    // with rising bubbles and no direction at all. Same data field, opposite
    // meaning, so the picture has to carry the difference.
    function drawConveyors() {
      if (!ZONES) return;
      const scroll = (engine.state.tick * 0.08) % 1;
      for (const z of ZONES) {
        const span = z.to - z.from, n = Math.max(2, Math.round(span / 0.6));
        // ⛱️ Blanket Cover (dmg < 1): a stretch of lane where your SHOTS land
        // soft. It must be unmistakable against both of the speed zones — the
        // conveyor's cyan directional chevrons and the mud's brown gloop — so it
        // is a cool SHADE thrown across the lane with a scalloped edge, i.e. it
        // reads as something overhead rather than something on the ground.
        // Drawn first and continued, so a band that carries only `dmg` never
        // falls through to the speed drawing.
        if (z.dmg != null && z.dmg < 1) {
          // ONE CONTINUOUS SHEET, not a string of beads. The first cut stamped an
          // ellipse every 0.6 cells while each was a full cell wide, so a 15-cell
          // band became 26 overlapping discs running down the lane with ~40 hem
          // circles beside them — reported from real play as "weird shadows",
          // and it was the literal circles-after-circles the prop fix had just
          // removed elsewhere. A cover is a sheet: stroke the lane once.
          const steps = Math.max(2, Math.round(span / 0.35));
          const pts = [], nrm = [];
          for (let i = 0; i <= steps; i++) {
            const d = z.from + (i / steps) * span;
            const q = engine.posAt(d), t = tangentAt(d);
            pts.push([(q.x + 0.5) * cell, (q.y + 0.5) * cell]);
            nrm.push([-t.y, t.x]);
          }
          const run = (off) => {
            ctx.beginPath();
            pts.forEach((q, i) => {
              const x = q[0] + nrm[i][0] * off, y = q[1] + nrm[i][1] * off;
              if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
            });
            ctx.stroke();
          };
          ctx.save();
          ctx.lineCap = "round"; ctx.lineJoin = "round";
          ctx.strokeStyle = "rgba(28,34,66,0.40)";
          ctx.lineWidth = cell * 0.92;
          run(0);
          // a brighter hem down each side, so the EDGE of the cover is legible
          ctx.strokeStyle = "rgba(122,148,222,0.55)";
          ctx.lineWidth = Math.max(1.5, cell * 0.07);
          run(cell * 0.44); run(-cell * 0.44);
          ctx.restore();
          continue;
        }
        // 🕳️ MUD PATCH (mult < 1) — the SAME defect as the cover band above, and
        // it survived the fix for it because the two are drawn by different code.
        // This stamped an ellipse every 0.6 cells, and the stamps read as a row
        // of beads with visible gaps: measured as an alpha varying 0.26-0.48
        // along L1's band and 0.01-0.37 along L7's, against 0.92-0.99 for a
        // continuous cover. L1 is the FIRST level anybody plays, so the original
        // "some of the shadows are just circles after circles" was still true
        // there after two rounds of fixing it elsewhere.
        //   A puddle is ONE body of goo. Fill the lane once between two wobbling
        // rims — the rim keeps it organic, which is what the stamps were for,
        // while the body between them is unbroken, which stamps never are.
        if (z.mult != null && z.mult < 1) {
          const steps = Math.max(4, Math.round(span / 0.3));
          const pts = [], nrm = [];
          for (let i = 0; i <= steps; i++) {
            const d = z.from + (i / steps) * span;
            const q = engine.posAt(d), t = tangentAt(d);
            pts.push([(q.x + 0.5) * cell, (q.y + 0.5) * cell]);
            nrm.push([-t.y, t.x]);
          }
          const hw = (i) => cell * (0.30 + 0.055 * Math.sin(i * 1.9) + 0.035 * Math.sin(i * 0.83 + 1.1));
          ctx.save();
          ctx.beginPath();
          for (let i = 0; i <= steps; i++) {
            const w = hw(i);
            const x = pts[i][0] + nrm[i][0] * w, y = pts[i][1] + nrm[i][1] * w;
            if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
          }
          for (let i = steps; i >= 0; i--) {
            const w = hw(i);
            ctx.lineTo(pts[i][0] - nrm[i][0] * w, pts[i][1] - nrm[i][1] * w);
          }
          ctx.closePath();
          ctx.fillStyle = "rgba(96,74,44,0.55)";
          ctx.fill();
          // Slow bubbles rising, so it reads as WET rather than as a hole. Two
          // changes from the per-stamp version: they are SCATTERED across the
          // puddle instead of filed down its centre-line (a file of bubbles is
          // neither natural nor readable), and they rise toward SCREEN-up via
          // bakeVec — this pass runs inside the rotated floor transform, so a
          // bare -y drifted them sideways in portrait, the same law that keeps
          // characters upright.
          const up = bakeVec({ x: 0, y: -1 });
          const bubbles = Math.max(2, Math.round(span / 1.2));
          for (let k = 0; k < bubbles; k++) {
            const i = Math.round(((k + 0.5) / bubbles) * steps);
            const ph = ((engine.state.tick * 0.03) + k * 0.37) % 1;
            const off = (k % 2 ? 0.17 : -0.15) * cell, rise = ph * cell * 0.22;
            ctx.fillStyle = "rgba(206,180,132," + (0.5 * (1 - ph)).toFixed(3) + ")";
            ctx.beginPath();
            ctx.arc(pts[i][0] + nrm[i][0] * off + up.x * rise,
              pts[i][1] + nrm[i][1] * off + up.y * rise,
              cell * 0.07 * (1 - ph * 0.5), 0, 7);
            ctx.fill();
          }
          ctx.restore();
          continue;
        }
        for (let i = 0; i <= n; i++) {
          const d = z.from + ((i + scroll) / n) * span;
          if (d < z.from || d > z.to) continue;
          const p = engine.posAt(d), tan = tangentAt(d);
          const cx = (p.x + 0.5) * cell, cy = (p.y + 0.5) * cell;
          const nx = -tan.y, ny = tan.x, s = cell * 0.28;
          ctx.strokeStyle = "rgba(120,230,255,0.55)"; ctx.lineWidth = Math.max(2, cell * 0.06); ctx.lineCap = "round"; ctx.lineJoin = "round";
          ctx.beginPath();
          ctx.moveTo(cx - tan.x * s + nx * s, cy - tan.y * s + ny * s);
          ctx.lineTo(cx + tan.x * s, cy + tan.y * s);
          ctx.lineTo(cx - tan.x * s - nx * s, cy - tan.y * s - ny * s);
          ctx.stroke();
        }
      }
    }

    // TD-16 🚪 Side Door: a wave group can walk in PARTWAY down the lane, so the
    // player has to be able to see where before they commit gold. Drawn during
    // BUILD only (once the wave is walking the enemies themselves say it), and
    // only for doors the NEXT wave actually uses — a permanent marker on a lane
    // that is not being used this wave is a lie.
    // ONE owner — the floor pass draws the line and the UPRIGHT pass draws the
    // 🚪 (characters never rotate), so both must agree on which doors are live.
    // REPORTED FROM REAL PLAY: "cannot see the door or anticipate it happening."
    // Two causes, both fixed here. (1) It vanished the instant the wave started —
    // the old comment claimed "the enemies themselves say it", but they walk in
    // BEHIND your guns, so by the time you see them the marker that would have
    // explained them is gone. A door now stays lit for as long as a wave using it
    // is in flight (waveIdx..sentIdx-1 — waves can OVERLAP since TD-15, so it is
    // a range, not one index). (2) It wore the EXIT's 🚪 — see the upright pass.
    function nextDoors() {
      const st = engine.state, waves = engine.levelDef.waves || [];
      const idxs = st.phase === "build" ? [st.sentIdx] : [];
      for (let i = st.waveIdx; i < st.sentIdx; i++) idxs.push(i); // in flight (empty during build)
      const out = new Set();
      for (const i of idxs) {
        const w = waves[i];
        if (w) w.groups.forEach((g) => { if (g.at > 0) out.add(g.at); });
      }
      return [...out];
    }
    function drawSideDoors() {
      for (const at of nextDoors()) {
        const p = engine.posAt(at), tan = tangentAt(at);
        const cx = (p.x + 0.5) * cell, cy = (p.y + 0.5) * cell;
        const nx = -tan.y, ny = tan.x;
        const pulse = 0.55 + 0.25 * Math.sin(engine.state.tick * 0.12);
        ctx.strokeStyle = "rgba(255,190,90," + pulse.toFixed(3) + ")";
        ctx.lineWidth = Math.max(2, cell * 0.08); ctx.lineCap = "round";
        // the gate itself, across the lane
        ctx.beginPath();
        ctx.moveTo(cx + nx * cell * 0.62, cy + ny * cell * 0.62);
        ctx.lineTo(cx - nx * cell * 0.62, cy - ny * cell * 0.62);
        ctx.stroke();
        // …and a chevron pointing DOWN-lane, so the marker says "they come in
        // here and walk THAT way" rather than just "something is here". Without
        // a direction a bare tick reads as a decoration.
        const hx = tan.x * cell * 0.55, hy = tan.y * cell * 0.55;
        for (const side of [1, -1]) {
          ctx.beginPath();
          ctx.moveTo(cx + nx * cell * 0.34 * side, cy + ny * cell * 0.34 * side);
          ctx.lineTo(cx + hx, cy + hy);
          ctx.stroke();
        }
      }
    }

    // TD-7 lever readability: the switch is a PERSISTENT toggle, so the field
    // itself must show which way the next train goes — running golden lights
    // along the whole ACTIVE route, and a dark veil over the branch the train
    // will NOT take (only its divergent middle — the shared prefix/tail belong
    // to both routes and stay lit). Drawn live in the FLOOR pass (the baked bg
    // never changes), animated off state.tick (frozen while paused; static, not
    // scrolling, under prefers-reduced-motion).
    function drawLeverRoute(st) {
      if (!leverSeg) return;
      const route = st.leverRoute ? 1 : 0;
      const polyline = (pts) => {
        ctx.beginPath();
        ctx.moveTo((pts[0][0] + 0.5) * cell, (pts[0][1] + 0.5) * cell);
        for (const [x, y] of pts.slice(1)) ctx.lineTo((x + 0.5) * cell, (y + 0.5) * cell);
        ctx.stroke();
      };
      ctx.lineCap = "round"; ctx.lineJoin = "round";
      // veil the closed branch
      ctx.setLineDash([]);
      ctx.strokeStyle = "rgba(10, 14, 22, 0.42)";
      ctx.lineWidth = cell * 1.05;
      polyline(leverSeg.mids[route ? 0 : 1]);
      // soft under-glow + running lights along the whole active route
      const active = lanes[route];
      ctx.strokeStyle = "rgba(255, 214, 90, 0.18)";
      ctx.lineWidth = cell * 0.5;
      polyline(active);
      ctx.strokeStyle = "rgba(255, 224, 120, 0.9)";
      ctx.lineWidth = Math.max(2, cell * 0.14);
      ctx.setLineDash([cell * 0.3, cell * 0.55]);
      ctx.lineDashOffset = reduceMotion ? 0 : -((st.tick * cell * 0.055) % (cell * 0.85));
      polyline(active);
      ctx.setLineDash([]); ctx.lineDashOffset = 0;
      lastLitLane = route;
    }

    // world-space particle fx (circles/lines — rotation-safe, drawn in FLOOR pass)
    function drawWorldFx() {
      for (const f of fx) {
        const a = f.ttl / f.max;
        if (f.kind === "poof") {
          ctx.fillStyle = "rgba(255,255,255," + (0.5 * a) + ")";
          ctx.beginPath(); ctx.arc(f.x * cell, f.y * cell, cell * 0.2 * (2 - a), 0, 7); ctx.fill();
        } else if (f.kind === "stars") {
          ctx.fillStyle = "rgba(255,226,122," + a + ")";
          for (let i = 0; i < 5; i++) {
            const ang = (i / 5) * Math.PI * 2 + f.ttl * 0.1;
            const r = cell * 0.45 * (1 - a);
            ctx.beginPath(); ctx.arc(f.x * cell + Math.cos(ang) * r, f.y * cell + Math.sin(ang) * r, 2.2, 0, 7); ctx.fill();
          }
        } else if (f.kind === "ring") {
          ctx.strokeStyle = "rgba(126,220,255," + a + ")"; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(f.x * cell, f.y * cell, cell * (1.2 - a * 0.6), 0, 7); ctx.stroke();
        } else if (f.kind === "chain") {
          ctx.strokeStyle = "rgba(160,240,255," + a + ")"; ctx.lineWidth = 2.5; ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo((f.points[0].x + 0.5) * cell, (f.points[0].y + 0.5) * cell);
          for (const p of f.points.slice(1)) ctx.lineTo((p.x + 0.5) * cell, (p.y + 0.5) * cell);
          ctx.stroke();
        } else if (f.kind === "boom") {
          ctx.strokeStyle = "rgba(255,180,90," + a + ")"; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(f.x * cell, f.y * cell, f.r * cell * (1.15 - a * 0.35), 0, 7); ctx.stroke();
        } else if (f.kind === "suck") { // Vacuum King inhale: a line + a shrinking ring at the boss
          const bx = (f.x + 0.5) * cell, by = (f.y + 0.5) * cell, sxp = f.sx * cell, syp = f.sy * cell;
          ctx.strokeStyle = "rgba(180,205,240," + (0.7 * a) + ")"; ctx.lineWidth = 2.5; ctx.lineCap = "round";
          ctx.beginPath(); ctx.moveTo(sxp, syp); ctx.lineTo(bx, by); ctx.stroke();
          ctx.strokeStyle = "rgba(150,185,230," + a + ")"; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(bx, by, cell * 0.7 * a, 0, 7); ctx.stroke();
        } else if (f.kind === "spark") { // The Static jam burst on a tower
          ctx.strokeStyle = "rgba(255,220,120," + a + ")"; ctx.lineWidth = 2.5; ctx.lineCap = "round";
          for (let i = 0; i < 6; i++) { const ang = (i / 6) * Math.PI * 2 + f.ttl * 0.2, rr = cell * 0.5 * (1.2 - a); ctx.beginPath(); ctx.moveTo(f.x * cell, f.y * cell); ctx.lineTo(f.x * cell + Math.cos(ang) * rr, f.y * cell + Math.sin(ang) * rr); ctx.stroke(); }
        }
      }
    }

    function drawScreenFx() { // text + full-screen flashes, never rotated
      for (const f of fx) {
        const a = f.ttl / f.max;
        if (f.kind === "pop") {
          // The character pass, upright, for the same reason the muzzle moved
          // here: only the FLOOR rotates in portrait, and a corpse is a body.
          // The synthetic carries every field drawEnemy reads — including
          // pathIdx/dist, because a live 🧨 reveal makes revealed() call epos().
          const p = worldToScreen(f.x, f.y);
          const k = 1 - a;
          ctx.save();
          ctx.globalAlpha = a;
          ctx.translate(p.x, p.y);
          ctx.scale(1 + k * 0.5, Math.max(0.08, 1 - k * 0.8));   // squash: wider, flatter
          withInk(() => drawEnemy({ type: f.etype, id: 0, hp: 0, maxHp: 1, shield: 0, pathIdx: 0, dist: 0 }, 0, 0), false);
          ctx.restore();
          continue;
        }
        if (f.kind === "muzzle") {
          // In the CHARACTER pass, not the floor pass. Drawn with the terrain fx
          // it was painted and then covered COMPLETELY by the tower body a few
          // lines later — measured as zero changed pixels across the whole
          // canvas, which reads exactly like "the effect does not work". A muzzle
          // flash belongs in front of the gun that made it.
          const p = worldToScreen(f.x, f.y);
          const big = f.line === "mortar" ? 1.5 : f.line === "fan" ? 0.9 : 1.0;
          const r0 = cell * 0.34 * big * (0.55 + a * 0.45);
          const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r0);
          g.addColorStop(0, "rgba(255,252,232," + (0.9 * a) + ")");
          g.addColorStop(0.45, "rgba(255,206,110," + (0.6 * a) + ")");
          g.addColorStop(1, "rgba(255,170,60,0)");
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(p.x, p.y, r0, 0, 7); ctx.fill();
        }
        if (f.kind === "gold") {
          const p = worldToScreen(f.x, f.y);
          ctx.fillStyle = "rgba(255,226,122," + a + ")";
          ctx.font = "bold " + Math.round(cell * 0.55) + "px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(f.text, p.x, p.y - (1 - a) * cell);
        } else if (f.kind === "dmgnum") { // TD-6 opt-in damage numbers
          const p = worldToScreen(f.x, f.y);
          ctx.fillStyle = (f.crit ? "rgba(255,180,90," : "rgba(255,255,255,") + a + ")";
          ctx.font = "bold " + Math.round(cell * (f.crit ? 0.6 : 0.44)) + "px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(f.text, p.x, p.y - cell * 0.5 - (1 - a) * cell * 0.8);
        } else if (f.kind === "leak") {
          ctx.fillStyle = "rgba(255,90,90," + ((f.deep || 0.25) * a) + ")";
          ctx.fillRect(0, 0, cssW, cssH);
        } else if (f.kind === "toll") { // what a multi-life leak actually cost
          const p = worldToScreen(f.x, f.y);
          const ty = p.y - (1 - a) * cell * 2;
          ctx.font = "bold " + Math.round(cell * 0.85) + "px sans-serif";
          ctx.textAlign = "center";
          // WHITE on a dark outline: this floats over the leak's red wash, so
          // red text would be invisible exactly when it matters most.
          ctx.lineWidth = Math.max(3, cell * 0.12);
          ctx.strokeStyle = "rgba(20,10,14," + a + ")";
          ctx.lineJoin = "round";
          ctx.strokeText(f.text, p.x, ty);
          ctx.fillStyle = "rgba(255,255,255," + a + ")";
          ctx.fillText(f.text, p.x, ty);
        }
      }
      // AGE EVERY fx, in a pass of its own. This used to sit at the bottom of
      // the draw loop above, where any branch that `continue`d skipped it — and
      // the corpse branch does continue, so a `pop` never aged, never faded and
      // was never spliced. Twenty dead bodies (MAX_POPS) piled up on the field
      // permanently, each drawn from a synthetic carrying hp 0, which is exactly
      // how it was reported: "bad guys after being killed are stuck on the map,
      // 0 health sprites just persisting there wave after wave". Worse, once the
      // cap filled, the corpse cue silently stopped working at all.
      //   Ageing cannot live inside a loop that has early exits. One pass, no
      // branches, so a future fx kind that needs its own `continue` inherits
      // correct lifetime for free.
      for (const f of fx) f.ttl -= 1;
      for (let i = fx.length - 1; i >= 0; i--) if (fx[i].ttl <= 0) fx.splice(i, 1);
    }

    // TD-9 Sticky Floor: an amber puddle on the FLOOR (drawn in the rotated world
    // pass with the path and conveyors — it is terrain, not a character), fading
    // out over its last second so its expiry is readable without a timer.
    function drawPuddles(st) {
      const list = st.puddles || [];
      if (!list.length) return;
      for (const z of list) {
        const left = (z.until - st.tick) / global.TDData.TICK_RATE;
        const a = Math.max(0.12, Math.min(0.42, left));
        // An oil SLICK and a sticky puddle do opposite things, so they must never
        // look alike: amber+bright for the slow you WANT, dark petrol with a cold
        // iridescent rim for the slick you do NOT. Same rule as the side-door
        // marker that wore the exit's own door — a mechanic the player cannot
        // tell apart from its opposite is a mechanic they cannot plan around.
        const oil = !!z.hurry;
        ctx.fillStyle = oil
          ? "rgba(24, 30, 26, " + Math.min(0.62, a + 0.18).toFixed(3) + ")"
          : "rgba(255, 196, 74, " + a.toFixed(3) + ")";
        ctx.beginPath();
        ctx.arc((z.x + 0.5) * cell, (z.y + 0.5) * cell, z.r * cell, 0, Math.PI * 2);
        ctx.fill();
        if (oil) {                                        // rainbow sheen inside the slick
          ctx.fillStyle = "rgba(126, 214, 255, " + (a * 0.55).toFixed(3) + ")";
          ctx.beginPath();
          ctx.ellipse((z.x + 0.32) * cell, (z.y + 0.34) * cell, z.r * cell * 0.46, z.r * cell * 0.24, 0.5, 0, 7);
          ctx.fill();
        }
        ctx.strokeStyle = oil
          ? "rgba(150, 230, 200, " + Math.min(0.85, a + 0.3).toFixed(3) + ")"
          : "rgba(255, 226, 122, " + Math.min(0.8, a + 0.25).toFixed(3) + ")";
        ctx.lineWidth = Math.max(1.5, cell * 0.05);
        ctx.stroke();
      }
    }

    function draw(alpha) {
      if (!bg) bakeBg();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cssW, cssH);
      // TD-6 screen-shake: offset the whole frame a few px on heavy impacts,
      // decaying deterministically. enterWorld()/character pass inherit it.
      if (shakeTtl > 0) {
        const m = shakeMag * (shakeTtl / 10);
        ctx.setTransform(dpr, 0, 0, dpr, Math.sin(shakeTtl * 1.9) * m * dpr, Math.cos(shakeTtl * 2.7) * m * dpr);
        shakeTtl -= 1;
      }
      const st = engine.state;

      // ---------- FLOOR pass (rotation-transformed) ----------
      enterWorld();
      ctx.drawImage(bg, 0, 0, cell * GRID.w, cell * GRID.h);
      drawConveyors();
      drawSideDoors();
      drawLeverRoute(st);
      drawPuddles(st);
      if (selection && selection.pad) drawRange(selection.pad.cx, selection.pad.cy, (selection.ghostRange || 2.6) * nightMul, true);
      if (selection && selection.tower) {
        const t = st.towers.find((x) => x.id === selection.tower);
        if (t) {
          const def = global.TDData.TOWERS[t.lineId];
          const s = (t.tier === 4 && t.branch) ? def.branches[t.branch] : def.tiers[t.tier - 1];
          // night dims dart/mortar reach — show the TRUE (reduced) ring, Fan exempt
          const ring = t.lineId === "fan" ? s.auraRange
            : t.lineId === "camp" ? global.TDData.TOWERS.camp.rallyRange
            : s.range * nightMul;
          drawRange(t.cx, t.cy, ring, true);
        }
      }
      drawWorldFx();
      exitWorld();

      // ---------- CHARACTER pass (upright, screen space) ----------
      drawZapBeams(st);           // BEFORE the towers, so a beam leaves the muzzle
      // Towers are the biggest, longest-lived, most deliberately-inspected things
      // on the board — you buy them, upgrade them and stare at them — so they are
      // exactly where the highlight earns its cost. There are at most 14.
      for (const t of st.towers) withInk(() => drawTower(t), true);
      for (const s of st.soldiers) if (s.alive) drawSoldier(s);
      // mortar shells arc between launch and impact
      for (const sh of st.shells) {
        const f = Math.min(1, sh.t / sh.T);
        const arc = Math.sin(Math.PI * f) * cell * 0.9;
        const p = worldToScreen(sh.x + 0.5, sh.y + 0.5);
        ctx.fillStyle = "rgba(0,0,0,0.25)";
        ctx.beginPath(); ctx.ellipse(p.x, p.y, cell * 0.12, cell * 0.06, 0, 0, 7); ctx.fill();
        ctx.fillStyle = "#c9803a";
        ctx.beginPath(); ctx.arc(p.x, p.y - arc, cell * 0.14, 0, 7); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.4)";
        ctx.beginPath(); ctx.arc(p.x - cell * 0.04, p.y - arc - cell * 0.04, cell * 0.04, 0, 7); ctx.fill();
      }
      const lerped = [];
      for (const e of st.enemies) {
        if (!e.alive) continue;
        const curP = engine.posOn(e.pathIdx, e.dist);
        const prev = prevPos.get(e.id) || curP;
        const wx = prev.x + (curP.x - prev.x) * alpha + 0.5;
        const wy = prev.y + (curP.y - prev.y) * alpha + 0.5;
        const p = worldToScreen(wx, wy);
        const bob = Math.sin((st.tick / 4) + e.id) * cell * 0.06;
        // 📌 Call the Shot: a whole-board focus fire you paid 70 gold and two ⚙️
        // for is only a decision if you can SEE which body it landed on. Drawn
        // UNDER the sprite so it reads as a ring on the floor, and noInk'd —
        // the silhouette pass is for bodies, not for a marker.
        if (st.markId === e.id && st.tick < st.markUntil) {
          const t = ((st.tick % 20) / 20);
          const pulse = reduceMotion ? 0.5 : t;             // static under prefers-reduced-motion
          noInk(() => {
            ctx.strokeStyle = "rgba(255,96,96,0.95)";
            ctx.lineWidth = Math.max(1.5, cell * 0.07);
            ctx.beginPath(); ctx.arc(p.x, p.y + bob, cell * (0.42 + pulse * 0.16), 0, 7); ctx.stroke();
            ctx.fillStyle = "rgba(255,96,96,0.9)";
            for (let k = 0; k < 4; k++) {                    // crosshair ticks
              const a = (Math.PI / 2) * k + Math.PI / 4;
              const r0 = cell * 0.44, r1 = cell * 0.62;
              ctx.beginPath();
              ctx.moveTo(p.x + Math.cos(a) * r0, p.y + bob + Math.sin(a) * r0);
              ctx.lineTo(p.x + Math.cos(a) * r1, p.y + bob + Math.sin(a) * r1);
              ctx.strokeStyle = "rgba(255,96,96,0.9)"; ctx.stroke();
            }
          });
        }
        const flashUntil = hitFlash.get(e.id) || 0;
        const flash = flashUntil > st.tick ? (flashUntil - st.tick) / FLASH_TICKS : 0;
        // A white tint ALONE does not work on this roster, and that is a
        // measurement rather than a preference: the bodies are deliberately PALE
        // (the whole reason the ink line exists), so even a FULL white overlay
        // moved only ~119 device pixels of a sock at cell 27, most of them by
        // less than 24/765 of RGB. So the flash is two cues — a warm tint, which
        // does the work on the dark bodies, and a brief SCALE pop, which reads on
        // any colour because it moves the silhouette itself.
        // The pop is MOTION, so it is gated on prefers-reduced-motion exactly as
        // the screen-shake is; the tint stays, so the cue never disappears
        // entirely for a player who asked for less movement.
        const pop = flash > 0 && !reduceMotion;
        if (pop) {
          const k = 1 + flash * 0.18;
          ctx.save();
          ctx.translate(p.x, p.y + bob); ctx.scale(k, k); ctx.translate(-p.x, -(p.y + bob));
        }
        withInk(() => drawEnemy(e, p.x, p.y + bob), !!(global.TDData.ENEMIES[e.type] || {}).boss, flash * 0.55); // silhouette law; bosses are big enough for the highlight
        if (pop) ctx.restore();
        if (e.slowUntil && st.tick < e.slowUntil) { // frost tint
          ctx.fillStyle = "rgba(140,210,255,0.32)";
          ctx.beginPath(); ctx.arc(p.x, p.y + bob, cell * 0.36, 0, 7); ctx.fill();
        }
        lerped.push({ e, x: p.x, y: p.y + bob });
      }
      // Projectiles (upright, on top of enemies). These used to be drawn from RAW
      // tick state while every enemy lerped by `alpha` — and a dart travels
      // 9 cells/s ÷ 30Hz = 0.30 cells/tick, which at cell 27 is an 8.1px jump
      // every other frame at 60fps. So the one fast-moving thing on the field
      // was the one thing that stuttered. Same `prevPos` treatment as enemies
      // (projectiles carry a stable `id`), plus a motion streak back along the
      // travel vector so a shot reads as a shot rather than a hovering dot.
      for (const pr of st.projectiles) {
        const prev = prevProj.get(pr.id) || pr;
        const px = prev.x + (pr.x - prev.x) * alpha, py = prev.y + (pr.y - prev.y) * alpha;
        const p = worldToScreen(px + 0.5, py + 0.5);
        const back = worldToScreen(px + 0.5 - (pr.x - prev.x) * 1.6, py + 0.5 - (pr.y - prev.y) * 1.6);
        ctx.strokeStyle = "rgba(255,231,140,0.5)";
        ctx.lineWidth = Math.max(1, cell * 0.07); ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(back.x, back.y); ctx.lineTo(p.x, p.y); ctx.stroke();
        ctx.fillStyle = "#fff3b0";
        ctx.beginPath(); ctx.arc(p.x, p.y, cell * 0.11, 0, 7); ctx.fill();
        ctx.fillStyle = pr.crit ? "#ffffff" : "#ffd94a";
        ctx.beginPath(); ctx.arc(p.x, p.y, cell * 0.07, 0, 7); ctx.fill();
      }

      // upright glyphs (bed / door / rally flag)
      // `fit` caps the drawn WIDTH. The bed measured 1.11 cells against a road
      // that measures exactly 1.00, so it overhung both kerbs and read as lying
      // across the lane rather than standing on it. Measured at draw time, not
      // assumed: iOS renders emoji WIDER than desktop, so a size that fits in
      // headless Chromium can still spill on the real iPad — the documented trap
      // that already spilled the tower panel and the next-wave line.
      const glyph = (wx, wy, ch, sz, fit) => {
        const p = worldToScreen(wx + 0.5, wy + 0.5);
        let px = Math.round(cell * (sz || 0.9));
        let ink = inkBox(ch, px);
        // Fit by the INK width, not the advance. The advance carries side
        // bearing, so fitting by it leaves the drawn picture narrower than asked
        // on one engine and wider on another — and "does it fit the road" is a
        // question about the picture, not about the font's box.
        if (fit && ink.w > fit) {
          px = Math.max(8, Math.floor(px * (fit / ink.w)));
          ink = inkBox(ch, px);
        }
        ctx.font = px + "px sans-serif";
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        // A COLOUR emoji ignores fillStyle, but a monochrome fallback glyph does
        // not — and this helper used to inherit whatever fill the previous draw
        // call happened to leave, so the bed/door/flag changed colour depending
        // on what was on the field. Always state it.
        ctx.fillStyle = "#eef3ff";
        ctx.fillText(ch, p.x - ink.dx, p.y - ink.dy);
        return ink.w;
      };
      // TD-7: the track-switch lever — a tappable round button on the fork. Red
      // when ready, steel + a sweeping ring while cooling down; a little arm shows
      // which way the track is currently thrown (route 0 = short, 1 = long).
      if (engine.levelDef.lever) {
        const lv = engine.levelDef.lever;
        const lp = worldToScreen(lv.cx + 0.5, lv.cy + 0.5);
        // TD-17: the diversion is TIMED, so the button is a clock. Three states,
        // read straight off the engine (never recomputed here — leverState() is
        // the one owner): RUNNING counts the diversion down, COOLDOWN counts to
        // re-arm, READY is tappable. The arc drains in both timed states, so
        // "how long have I got?" is answerable at a glance without reading text.
        const RU = global.TDData.RULES;
        const ls = engine.leverState() || { phase: "ready", secs: 0 };
        const span = ls.phase === "running" ? (RU.leverHold || 10) : (RU.leverCooldown || 10);
        const frac = ls.phase === "ready" ? 0 : Math.max(0, Math.min(1, ls.secs / span));
        const rad = cell * 0.46;
        ctx.fillStyle = "rgba(0,0,0,0.3)"; ctx.beginPath(); ctx.ellipse(lp.x, lp.y + cell * 0.14, rad * 0.95, rad * 0.45, 0, 0, 7); ctx.fill();
        // running = live blue (it is DOING something), cooling = dead steel, ready = red
        ctx.fillStyle = ls.phase === "running" ? "#1f6fb2" : ls.phase === "cooldown" ? "#54627a" : "#c8382a";
        ctx.beginPath(); ctx.arc(lp.x, lp.y, rad, 0, 7); ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.9)"; ctx.lineWidth = Math.max(2, cell * 0.06);
        ctx.beginPath(); ctx.arc(lp.x, lp.y, rad, 0, 7); ctx.stroke();
        if (frac > 0) { // arc DRAINS clockwise as the timer runs out
          ctx.strokeStyle = ls.phase === "running" ? "rgba(160,225,255,0.98)" : "rgba(255,225,120,0.95)";
          ctx.lineWidth = Math.max(2, cell * 0.1);
          ctx.beginPath(); ctx.arc(lp.x, lp.y, rad * 0.72, -Math.PI / 2, -Math.PI / 2 + frac * 2 * Math.PI); ctx.stroke();
        }
        // …and the number itself, because an arc says "some" and a player
        // deciding whether to spend a wave on it needs "3".
        if (ls.phase !== "ready") {
          ctx.font = "800 " + Math.max(10, Math.round(cell * 0.42)) + "px sans-serif";
          ctx.textAlign = "center"; ctx.textBaseline = "middle";
          const secs = String(Math.ceil(ls.secs));
          ctx.lineWidth = Math.max(2, cell * 0.14); ctx.strokeStyle = "rgba(8,12,20,0.85)"; ctx.lineJoin = "round";
          ctx.strokeText(secs, lp.x, lp.y);
          ctx.fillStyle = "#fff"; ctx.fillText(secs, lp.x, lp.y);
        }
        // the thrown-arm indicator (points toward the active branch direction)
        const dir = st.leverRoute ? -1 : 1;
        ctx.strokeStyle = "#fff"; ctx.lineWidth = Math.max(2, cell * 0.09); ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(lp.x, lp.y + cell * 0.1); ctx.lineTo(lp.x + dir * cell * 0.24, lp.y - cell * 0.24); ctx.stroke();
        ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(lp.x + dir * cell * 0.24, lp.y - cell * 0.24, cell * 0.08, 0, 7); ctx.fill();
        // The tag names the CURRENT route, and when the lever is armed it says so
        // — "SHORT WAY" alone never told you the button was waiting for a tap,
        // which is half of why the old toggle read as fire-and-forget.
        const tag = ls.phase === "running" ? "LONG WAY" : ls.phase === "cooldown" ? "SHORT WAY" : "TAP: LONG WAY";
        ctx.font = "700 " + Math.max(9, Math.round(cell * 0.3)) + "px sans-serif";
        ctx.textAlign = "center"; ctx.textBaseline = "top";
        const ty = lp.y + rad + cell * 0.16;
        ctx.lineWidth = Math.max(2, cell * 0.12); ctx.strokeStyle = "rgba(8, 12, 20, 0.85)"; ctx.lineJoin = "round";
        ctx.strokeText(tag, lp.x, ty);
        ctx.fillStyle = st.leverRoute ? "#9fd2ff" : "#ffd9a0";
        ctx.fillText(tag, lp.x, ty);
      }
      const prim = lanes[0]; const s0 = prim[0], s1 = prim[prim.length - 1]; // lanes share spawn+exit
      // The spawn marker is a DATA field on the world, not an if/else chain —
      // the chain silently fell through to the bedroom's 🛏️ for the whole attic
      // (the same class as the enemy draw that marched the Tickmaster in as a
      // sock), so a 5th world would have inherited a bed too.
      const spawnGlyph = (global.TDData.WORLDS[engine.levelDef.world] || {}).spawnGlyph || "🛏️";
      // ON THE ROAD, not on its end cap. A lane's first and last waypoints sit at
      // the board EDGE, so both markers were centred half a cell in, straddling
      // the lane's rounded cap with the cap poking out past them — reported as
      // "the entrance bed isn't on the path". Stepping a little way ALONG the
      // first (and last) segment puts each marker squarely on the road it
      // belongs to, at any board size and in either orientation.
      const along = (a, b, d) => {
        const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
        return [a[0] + (dx / L) * d, a[1] + (dy / L) * d];
      };
      const INSET = 0.85;
      const ROAD_FIT = 0.82;   // the painted road measures exactly 1.00 cells
      markers.spawn = prim.length > 1 ? along(prim[0], prim[1], INSET) : s0;
      markers.exit = prim.length > 1 ? along(prim[prim.length - 1], prim[prim.length - 2], INSET) : s1;
      markers.spawnW = glyph(markers.spawn[0], markers.spawn[1], spawnGlyph, 0.9, cell * ROAD_FIT);
      // TD-16 side doors, upright like every other character. ON the crossbar,
      // not offset from it: the FLOOR rotates 90° in portrait while characters
      // stay upright, so a world-y offset here would come out as a screen-x
      // offset and the door would sit beside its own marker.
      //
      // It used to draw 🚪 — the EXIT's own glyph (below). Identical pictures for
      // "enemies come IN here" and "enemies escape here, costing you lives" is
      // exactly the defect the enemy-art pixel hash exists to catch, applied to
      // field markers instead of sprites. A side door IS a second spawn, so it
      // wears the WORLD's spawn glyph (a data field, so a new world inherits it)
      // at 0.72 — same picture as where they already come from, smaller so the
      // primary spawn still reads as primary.
      for (const at of nextDoors()) { const dp = engine.posAt(at); glyph(dp.x, dp.y, spawnGlyph, 0.72, cell * ROAD_FIT); }
      markers.exitW = glyph(markers.exit[0], markers.exit[1], "🚪", 0.9, cell * ROAD_FIT);
      if (selection && selection.tower) {
        const selT = st.towers.find((x) => x.id === selection.tower);
        // rallyX/rallyY are path points — cell-index space, exactly like an
        // enemy's position — so the flag centres like every other sprite. The
        // old `- 0.5` cancelled glyph()'s centring and planted the flag half a
        // cell up-left of the soldiers actually standing on it.
        if (selT && selT.lineId === "camp") glyph(selT.rallyX, selT.rallyY, "🚩", 0.8);
      }
      // enemy hp bars (upright). A boss draws at its `size` scale, so a bar
      // pinned 0.6 cells above the CENTRE was painted inside the body of every
      // boss in the game — exactly the enemy whose health you most need to read.
      // It rides the sprite's real half-height, and grows with it.
      for (const { e, x, y } of lerped) {
        if (e.hp >= e.maxHp) continue;
        const sc = bossScale(e, 1);
        const w = cell * 0.6 * Math.min(2, sc), frac = Math.max(0, e.hp / e.maxHp);
        const top = y - cell * (0.5 * sc + 0.16), h = Math.max(3, Math.round(3 * Math.min(2, sc)));
        ctx.fillStyle = "rgba(0,0,0,0.45)";
        ctx.fillRect(x - w / 2, top, w, h);
        ctx.fillStyle = frac > 0.5 ? "#69d06a" : "#f0b040";
        ctx.fillRect(x - w / 2, top, w * frac, h);
      }
      drawScreenFx();
    }

    function afterTick() {
      prevPos.clear();
      for (const e of engine.state.enemies) if (e.alive) prevPos.set(e.id, engine.posOn(e.pathIdx, e.dist));
      prevProj.clear();
      for (const pr of engine.state.projectiles) prevProj.set(pr.id, { x: pr.x, y: pr.y });
    }

    resize();
    return {
      draw, resize, pushFx, afterTick,
      setSelection: (s) => { selection = s; },
      setDamageNumbers: (on) => { showDmg = !!on; }, // TD-6 opt-in
      shakeInfo: () => ({ ttl: shakeTtl, mag: shakeMag, reduced: reduceMotion }), // test hook
      leverInfo: () => ({ hasSeg: !!leverSeg, lit: lastLitLane }), // test hook: which lane the route overlay lit last draw
      markerInfo: () => ({ spawn: markers.spawn, exit: markers.exit, spawnW: markers.spawnW, exitW: markers.exitW, cell }), // test hook: where the spawn/exit markers were drawn
      // test hook (the leverInfo precedent): which side doors are lit right now
      // and what picture marks them. Reported from real play as invisible —
      // it wore the EXIT's 🚪 and vanished the moment the wave started — so the
      // guardrail asserts a DISTINCT glyph and that it survives into the wave.
      doorInfo: () => ({
        doors: nextDoors(),
        glyph: (global.TDData.WORLDS[engine.levelDef.world] || {}).spawnGlyph || "🛏️",
        exitGlyph: "🚪",
      }),
      cellSize: () => cell,
      isRotated: () => rotated,
      worldToScreen, screenToWorld,
    };
  }

  const API = { create };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  if (global && typeof global === "object") global.TDRender = API;
})(typeof window !== "undefined" ? window : globalThis);
