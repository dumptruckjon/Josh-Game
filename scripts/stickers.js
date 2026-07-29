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

  // A real sticker is a picture ON a shaped, coloured badge — and that BACKING is
  // what took the book from 73 unique pictures across 200 slots (with one group of
  // 25 byte-identical rockets) to 200 unique stickers. The old key was two axes,
  // kind x colour, so 8 x 12 = 96 combinations had to cover 200 games and 160 of
  // them collided. Each axis below reads a DISJOINT bit-field of the same hash, so
  // adding one multiplies the space instead of re-shuffling it, and every sticker
  // stays a pure deterministic function of the game id.
  const BACKINGS = ["disc", "ring", "burst", "squircle", "shield"];
  const SKINS = ["#f1c9a5", "#e0ac7e", "#c68642", "#8d5524", "#fadcbc"];
  const HAIRS = ["#2a1a12", "#1a1a20", "#6b4423", "#3b2f2f", "#0f0f14"];

  // The badge behind the picture. Drawn here rather than in JoshArt because it is
  // a sticker-book concept, not a character.
  // NO <radialGradient> here, and that is the point. The first cut gave every
  // badge `<defs><radialGradient id="bg">` — but SVG fragment identifiers resolve
  // DOCUMENT-WIDE, and the Sticker Book paints all 200 stickers into one page, so
  // every `url(#bg)` would have resolved to the FIRST sticker's gradient and
  // collapsed 200 carefully-varied badge colours into one. The uniqueness test
  // could never catch it: the STRINGS all differ, only the rendering collapses.
  // A flat fill plus a lighter top arc gives the same domed look, needs no id at
  // all (so it cannot collide), and skips 200 gradient objects on a page that a
  // WebKit device has to composite.
  function backing(shape, fill, edge) {
    // CHEAP shapes, deliberately. The first cut drew a 24-point rosette and a
    // 20-point burst, and the Sticker Book paints 200 of these at once — on
    // WebKit's software rasterizer (Josh's iPad, and CI) that many path points is
    // real cost for a page whose job is to look like a scrapbook. Every shape here
    // is <= 8 points and still visibly its own badge, so the five axes that make
    // 200 stickers unique are untouched.
    const dome = '<path d="M14 42 Q28 12 58 10 Q34 20 24 46 Z" fill="rgba(255,255,255,0.34)"/>';
    let body;
    if (shape === "ring") {
      body = '<circle cx="50" cy="50" r="47" fill="' + fill + '" stroke="' + edge + '" stroke-width="2.5"/>' +
        '<circle cx="50" cy="50" r="35" fill="none" stroke="' + edge + '" stroke-width="4"/>' + dome;
    } else if (shape === "burst") {
      let pts = "";
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 - Math.PI / 2, rad = i % 2 ? 32 : 49;
        pts += (i ? " " : "") + (50 + Math.cos(a) * rad).toFixed(1) + "," + (50 + Math.sin(a) * rad).toFixed(1);
      }
      body = '<polygon points="' + pts + '" fill="' + fill + '" stroke="' + edge + '" stroke-width="2"/>' + dome;
    } else if (shape === "squircle") {
      body = '<rect x="4" y="4" width="92" height="92" rx="26" fill="' + fill + '" stroke="' + edge + '" stroke-width="2.5"/>' + dome;
    } else if (shape === "shield") {
      body = '<path d="M50 3 L94 17 V52 Q94 82 50 97 Q6 82 6 52 V17 Z" fill="' + fill + '" stroke="' + edge + '" stroke-width="2.5"/>' + dome;
    } else {
      body = '<circle cx="50" cy="50" r="47" fill="' + fill + '" stroke="' + edge + '" stroke-width="2.5"/>' + dome;
    }
    return body;
  }

  // Two more axes, because the badge alone left 5 colliding pairs out of 200 —
  // exactly the birthday count for the space it created (the six single-colour
  // kinds only had 12 x 5 x 12 x 3 = 2160 combinations to spread ~150 games
  // across). Sparkles and the rim multiply it by 8 and take the shipped set to
  // 200 unique. Both are deterministic and drawn OVER the badge, under the art.
  function sparkles(n, fill) {
    let out = "";
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (i / Math.max(1, n)) * Math.PI * 2 + 0.5;
      const x = 50 + Math.cos(a) * 41, y = 50 + Math.sin(a) * 41;
      out += '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="4" fill="' + fill + '"/>';
    }
    return out;
  }

  function artFor(def) {
    const ART = global.JoshArt;
    const id = (def && def.id) || String(def || "");
    const h = hashStr(id);
    // A SECOND, differently-seeded hash for the badge axes. Slicing one hash into
    // bit-fields correlates the axes through the modulo (12 and 5 do not divide a
    // power of two), and that left 5 colliding pairs out of 200; two independent
    // streams left none. The picture axes keep reading `h`, so no sticker that was
    // already unique changes its character — only its badge.
    const h2 = hashStr("badge:" + id);
    if (!ART) return "";
    const color = PALETTE[h % PALETTE.length];
    const kind = KINDS[(h >>> 4) % KINDS.length];
    const shape = BACKINGS[h2 % BACKINGS.length];
    // The badge colour must not be the picture's own colour, or the sticker
    // reads as a monochrome blob.
    let badge = PALETTE[(h2 >>> 5) % PALETTE.length];
    if (badge === color) badge = PALETTE[((h2 >>> 5) + 5) % PALETTE.length];
    const pose = (h2 >>> 11) % 3;                             // a slight tilt
    const spark = (h2 >>> 14) % 4;                            // 0-3 sparkles
    const rim = (h2 >>> 17) % 2;                              // a second inner ring
    const inner = (function () {
      switch (kind) {
        case "hero": return ART.hero(color);
        case "numberFriend": return ART.numberFriend((h % 9) + 1, color);
        case "pup": return ART.pup(color);
        case "balloon": return ART.balloon(color);
        case "friend": return ART.friend({
          skin: SKINS[(h >>> 20) % SKINS.length], hair: HAIRS[(h >>> 23) % HAIRS.length],
          style: HAIR[(h >>> 26) % HAIR.length], shirt: color,
        });
        case "rocket": return ART.rocket(color);
        case "truck": return ART.truck(color);
        default: return ART.star(color);
      }
    })();
    // Nest the character's own 0-100 svg inside the badge at 72% scale, so every
    // art function keeps its viewBox contract (a shipped art test asserts it).
    const tilt = [-7, 0, 7][pose];
    const body = String(inner).replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "");
    const edge = ART.shade ? ART.shade(badge, -0.3) : badge;
    const ring = rim ? '<circle cx="50" cy="50" r="38" fill="none" stroke="rgba(255,255,255,0.45)" stroke-width="2" stroke-dasharray="5 4"/>' : "";
    return '<svg viewBox="0 0 100 100">' + backing(shape, badge, edge) + ring + sparkles(spark, "rgba(255,255,255,0.9)") +
      '<g transform="translate(50 50) rotate(' + tilt + ') scale(0.72) translate(-50 -50)">' + body + "</g></svg>";
  }

  global.JoshStickers = { artFor };
})(typeof window !== "undefined" ? window : globalThis);
