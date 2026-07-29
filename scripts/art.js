// Original homage SVG art for Josh's Games — friendly, simple characters drawn
// from basic shapes so they stay crisp at any size. These are ORIGINAL designs
// "in the style of" his favourites (masked spider-hero, number-friends, rescue
// pups, a dumptruck), NOT reproductions of any copyrighted characters.
//
// Each function returns an inline <svg> string. Works in the browser
// (window.JoshArt) and Node (module.exports) so the shapes can be unit-tested.

(function (global) {
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const wrap = (inner, extra) => '<svg viewBox="0 0 100 100" ' + (extra || "") + ">" + inner + "</svg>";

  // Darken (amt < 0) or lighten (amt > 0) a #rrggbb by a fraction. PURE, and
  // exported so a unit test can pin it — every character that wants a shaded
  // edge or a highlight goes through here instead of hand-picking a second hex,
  // so a new colour in `HEROES`/`PUPS` gets a matching shade for free.
  function shade(hex, amt) {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ""));
    if (!m) return hex;
    const n = parseInt(m[1], 16);
    const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) =>
      Math.round(amt < 0 ? c * (1 + amt) : c + (255 - c) * amt));
    return "#" + ch.map((c) => clamp(c, 0, 255).toString(16).padStart(2, "0")).join("");
  }

  // A friendly masked spider-hero (red = Spidey, pink = Ghost-Spider, blue = Spin).
  //
  // REDRAWN 2026-07, and it is the highest-reach asset in the app: `buddy.js`
  // builds its roster HEROES-first and falls back to `ROSTER[0]`, so this IS the
  // default buddy — the home-screen companion and the celebration pop on all 200
  // wins — for any child who never opens the picker. It is also the art of
  // find-hero, thwip-web, thwip-villains, web-swing, peekaboo, who-is-it,
  // copy-beat, 24 Sticker Book slots and 3 chooser tiles.
  //
  // The old drawing was four shapes: a body ellipse and a head circle in the SAME
  // colour, tangent, so they fused into a figure-8; web lines at 0.16 alpha that
  // were invisible AND crossed the eyes; and no arms, legs, hands or emblem.
  // Screenshotted at 120px it read as a red peanut with eyes. Now there is a
  // posed figure — legs, boots, torso, a thwip arm with a web, a chest emblem,
  // real mask webbing on the head only, eyes drawn LAST so nothing crosses them.
  // Still an original homage, never the copyrighted artwork. Keep it a PURE
  // function of `color` (the e2e buddy test compares innerHTML byte-for-byte),
  // and keep most of the ink in `color` so find-hero stays a colour search.
  function hero(color) {
    color = color || "#e23636";
    const dk = shade(color, -0.34), lt = shade(color, 0.2);
    return wrap(
      '<ellipse cx="50" cy="96" rx="20" ry="3.5" fill="rgba(0,0,0,0.12)"/>' +
      '<rect x="37" y="70" width="10" height="21" rx="5" fill="' + dk + '"/>' +
      '<rect x="53" y="70" width="10" height="21" rx="5" fill="' + dk + '"/>' +
      '<rect x="32" y="86" width="17" height="9" rx="4.5" fill="#1b1f2e"/>' +
      '<rect x="51" y="86" width="17" height="9" rx="4.5" fill="#1b1f2e"/>' +
      '<path d="M34 49 Q50 43 66 49 L63 75 Q50 80 37 75 Z" fill="' + color + '"/>' +
      '<path d="M37 54 L19 40" stroke="' + color + '" stroke-width="9" stroke-linecap="round" fill="none"/>' +
      '<path d="M63 54 L79 66" stroke="' + color + '" stroke-width="9" stroke-linecap="round" fill="none"/>' +
      '<circle cx="18" cy="38" r="6.5" fill="' + lt + '"/>' +
      '<circle cx="81" cy="68" r="6.5" fill="' + lt + '"/>' +
      '<path d="M18 38 L5 23 M18 38 L11 21 M18 38 L3 30" stroke="rgba(255,255,255,0.85)" stroke-width="2" stroke-linecap="round" fill="none"/>' +
      '<ellipse cx="50" cy="57" rx="3" ry="4" fill="' + dk + '"/>' +
      '<path d="M47 55 L41 51 M53 55 L59 51 M47 59 L41 63 M53 59 L59 63" stroke="' + dk + '" stroke-width="1.5" stroke-linecap="round" fill="none"/>' +
      '<circle cx="50" cy="30" r="21" fill="' + color + '"/>' +
      '<path d="M50 9 V51 M29 30 H71 M35 15 L65 45 M65 15 L35 45" stroke="' + dk + '" stroke-width="1.4" fill="none" opacity="0.6"/>' +
      '<path d="M50 18 Q38 23 33 32 M50 18 Q62 23 67 32" stroke="' + dk + '" stroke-width="1.2" fill="none" opacity="0.5"/>' +
      '<path d="M31 30 Q36 19 47 25 Q45 38 33 37 Z" fill="#fff" stroke="#1b1f2e" stroke-width="2"/>' +
      '<path d="M69 30 Q64 19 53 25 Q55 38 67 37 Z" fill="#fff" stroke="#1b1f2e" stroke-width="2"/>'
    );
  }

  // A Numberblock-style number-friend: a stack of n colored cubes with a face
  // and little arms. Grows taller as n grows.
  function numberFriend(n, color) {
    n = clamp(Math.round(n || 1), 1, 10);
    color = color || "#5ec8ff";
    const cubeH = Math.min(18, 76 / n);
    const w = 44, x = 28;
    let cubes = "";
    for (let i = 0; i < n; i++) {
      const y = 90 - (i + 1) * cubeH;
      cubes += '<rect x="' + x + '" y="' + y.toFixed(1) + '" width="' + w + '" height="' + (cubeH - 2).toFixed(1) +
        '" rx="4" fill="' + color + '" stroke="rgba(0,0,0,0.15)" stroke-width="1"/>';
    }
    const topY = 90 - n * cubeH;
    const eyeY = topY + cubeH * 0.42;
    const midY = 90 - (n * cubeH) / 2;
    const limbs = '<line x1="' + x + '" y1="' + midY.toFixed(1) + '" x2="16" y2="' + (midY - 4).toFixed(1) + '" stroke="#333" stroke-width="2"/>' +
      '<line x1="' + (x + w) + '" y1="' + midY.toFixed(1) + '" x2="84" y2="' + (midY - 4).toFixed(1) + '" stroke="#333" stroke-width="2"/>';
    const face = '<circle cx="42" cy="' + eyeY.toFixed(1) + '" r="2.7" fill="#fff"/><circle cx="42" cy="' + eyeY.toFixed(1) + '" r="1.3" fill="#111"/>' +
      '<circle cx="58" cy="' + eyeY.toFixed(1) + '" r="2.7" fill="#fff"/><circle cx="58" cy="' + eyeY.toFixed(1) + '" r="1.3" fill="#111"/>' +
      '<path d="M44 ' + (eyeY + 4).toFixed(1) + ' Q50 ' + (eyeY + 7).toFixed(1) + ' 56 ' + (eyeY + 4).toFixed(1) + '" stroke="#111" stroke-width="1.6" fill="none" stroke-linecap="round"/>';
    return wrap(cubes + limbs + face);
  }

  // A friendly rescue pup with a colored collar + badge (Paw Patrol homage).
  // AMBIGUITY FIX 2026-07. Every pup was the IDENTICAL beige dog and the only
  // per-pup mark was a `<rect width="40" height="8">` collar — which at the
  // rescue game's 42px dot size is **16.8 × 3.4 CSS px**, repeated across 12-22
  // near-identical dogs. Rescue is a COUNTING game whose right answer depends on
  // telling six dogs apart, so it was asking a 4-year-old to do 3-pixel colour
  // matching (and the palette put #ffd24d beside #ff9f43, #e23636 beside
  // #ff7ac0). Exactly the documented law that a puzzle read off a drawn scene
  // must keep that scene UNAMBIGUOUS. Each pup now differs in COAT, EAR SHAPE,
  // PATCHES and CAP — silhouette first, so it survives at thumbnail size — and
  // the spec lives in `content.js` `PUPS[].art` so it is truth-tested like the
  // friends' distinctness. The collar stays; it is just no longer the only cue.
  function pup(collar, spec) {
    collar = collar || "#e23636";
    spec = spec || {};
    const coat = spec.coat || "#e3b781";
    const ear = shade(coat, -0.22);
    const ears = spec.ears === "pointy"
      ? '<path d="M18 48 L25 12 L41 33 Z" fill="' + ear + '"/><path d="M82 48 L75 12 L59 33 Z" fill="' + ear + '"/>'
      : spec.ears === "round"
        ? '<circle cx="22" cy="28" r="13" fill="' + ear + '"/><circle cx="78" cy="28" r="13" fill="' + ear + '"/>'
        : '<ellipse cx="24" cy="40" rx="12" ry="20" fill="' + ear + '"/><ellipse cx="76" cy="40" rx="12" ry="20" fill="' + ear + '"/>';
    const patch = spec.patch
      ? '<circle cx="62" cy="38" r="11" fill="' + spec.patch + '"/><circle cx="33" cy="55" r="6" fill="' + spec.patch + '"/>'
      : "";
    const cap = spec.cap
      ? '<path d="M25 30 Q50 10 75 30 Q50 24 25 30 Z" fill="' + spec.cap + '"/>' +
        '<rect x="60" y="27" width="24" height="5" rx="2.5" fill="' + shade(spec.cap, -0.2) + '"/>'
      : "";
    return wrap(
      ears +
      '<circle cx="50" cy="46" r="30" fill="' + coat + '"/>' +
      patch +
      '<circle cx="40" cy="42" r="4" fill="#3a2a15"/><circle cx="60" cy="42" r="4" fill="#3a2a15"/>' +
      '<ellipse cx="50" cy="58" rx="14" ry="10" fill="' + shade(coat, 0.3) + '"/>' +
      '<ellipse cx="50" cy="53" rx="4.5" ry="3.2" fill="#3a2a15"/>' +
      '<path d="M46 62 Q50 71 54 62 Z" fill="#ff8fa3"/>' +
      cap +
      '<rect x="30" y="72" width="40" height="8" rx="4" fill="' + collar + '"/>' +
      '<circle cx="50" cy="76" r="6" fill="#ffd24d" stroke="' + collar + '" stroke-width="1.5"/>'
    );
  }

  // A construction dumptruck (Rubble & Crew homage).
  function truck(color) {
    color = color || "#ffb703";
    return wrap(
      '<polygon points="18,40 64,40 58,64 18,64" fill="' + color + '"/>' +
      '<rect x="64" y="42" width="18" height="22" rx="3" fill="#ffd24d"/>' +
      '<rect x="67" y="46" width="11" height="9" rx="2" fill="#bfe9ff"/>' +
      '<rect x="14" y="64" width="72" height="7" fill="#555"/>' +
      '<circle cx="32" cy="76" r="9" fill="#333"/><circle cx="32" cy="76" r="4" fill="#aaa"/>' +
      '<circle cx="72" cy="76" r="9" fill="#333"/><circle cx="72" cy="76" r="4" fill="#aaa"/>'
    );
  }

  // A cheerful star with a face (matches the app icon).
  function star(color) {
    color = color || "#ffd24d";
    return wrap(
      '<polygon points="50,6 61,38 96,38 68,59 79,92 50,71 21,92 32,59 4,38 39,38" fill="' + color + '" stroke="#f5a623" stroke-width="2"/>' +
      '<circle cx="43" cy="46" r="3" fill="#3a2a00"/><circle cx="57" cy="46" r="3" fill="#3a2a00"/>' +
      '<path d="M44 54 Q50 60 56 54" stroke="#3a2a00" stroke-width="2" fill="none" stroke-linecap="round"/>'
    );
  }

  // The one art kind that IGNORED its colour argument — which is why 25 Sticker
  // Book slots held a byte-identical rocket. The hull stays a pale spacecraft
  // white (a rocket is not a coloured blob) and the colour lands on the fins and
  // the nose band, so the callers' palette actually reaches it.
  function rocket(color) {
    color = color || "#e23636";
    const dk = shade(color, -0.28);
    return wrap(
      '<path d="M50 8 C64 22 66 44 60 62 H40 C34 44 36 22 50 8 Z" fill="#eceff4" stroke="#c7ced9" stroke-width="1.5"/>' +
      '<path d="M43 18 Q50 12 57 18 Q50 22 43 18 Z" fill="' + color + '"/>' +
      '<circle cx="50" cy="34" r="8" fill="#5ec8ff" stroke="#2b6cff" stroke-width="2"/>' +
      '<polygon points="40,54 26,68 40,64" fill="' + color + '"/><polygon points="60,54 74,68 60,64" fill="' + color + '"/>' +
      '<rect x="40" y="56" width="20" height="4" rx="2" fill="' + dk + '"/>' +
      '<path d="M44 62 H56 L52 84 Q50 90 48 84 Z" fill="#ffa64d"/>'
    );
  }

  function balloon(color) {
    color = color || "#ff5e7e";
    return wrap(
      '<ellipse cx="50" cy="40" rx="28" ry="34" fill="' + color + '"/>' +
      '<path d="M46 72 L54 72 L50 80 Z" fill="' + color + '"/>' +
      '<path d="M50 80 C 53 88 47 92 50 100" stroke="#999" stroke-width="1.5" fill="none"/>' +
      '<ellipse cx="42" cy="30" rx="6" ry="9" fill="rgba(255,255,255,0.45)"/>'
    );
  }

  function home() {
    return wrap(
      '<polygon points="50,14 88,46 12,46" fill="#e2574c"/>' +
      '<rect x="24" y="46" width="52" height="40" fill="#f4d9a6"/>' +
      '<rect x="44" y="60" width="16" height="26" fill="#8a5a2b"/>' +
      '<rect x="30" y="54" width="12" height="12" fill="#bfe9ff"/><rect x="58" y="54" width="12" height="12" fill="#bfe9ff"/>'
    );
  }

  // A simple friend kid avatar (rotate skin/shirt for Raegar/River/Viraj/Josh).
  function kid(skin, shirt) {
    skin = skin || "#e8b98c";
    shirt = shirt || "#5ec8ff";
    return wrap(
      '<rect x="30" y="60" width="40" height="34" rx="10" fill="' + shirt + '"/>' +
      '<circle cx="50" cy="40" r="24" fill="' + skin + '"/>' +
      '<circle cx="42" cy="38" r="3" fill="#3a2a15"/><circle cx="58" cy="38" r="3" fill="#3a2a15"/>' +
      '<path d="M42 48 Q50 55 58 48" stroke="#3a2a15" stroke-width="2.5" fill="none" stroke-linecap="round"/>'
    );
  }

  // A friendly kid PORTRAIT with hair, so Josh and each friend are clearly
  // DIFFERENT people (distinct skin + hair style/colour + shirt). spec:
  // { skin, hair, style: fringe|wavy|bowl|curly|short, shirt }. Original art —
  // just a warm cartoon face, chosen to gently reflect each kid so the helpers
  // "look like him and his friends" (JOSH_PROFILE).
  function hairFor(style, hair) {
    switch (style) {
      case "fringe": // straight black fringe / bangs
        return '<path d="M26 41 Q26 15 50 15 Q74 15 74 41 Q74 28 65 27 L58 33 L50 28 L42 33 L35 27 Q26 28 26 41 Z" fill="' + hair + '"/>';
      case "wavy": // fuller wavy hair down the sides
        return '<path d="M24 47 Q22 14 50 13 Q78 14 76 47 Q73 35 74 30 Q67 35 62 30 Q56 37 50 30 Q44 37 38 30 Q33 35 26 30 Q27 35 24 47 Z" fill="' + hair + '"/>';
      case "bowl": // smooth rounded cut with a soft centre part
        return '<path d="M26 39 Q26 15 50 15 Q74 15 74 39 Q68 30 50 30 Q32 30 26 39 Z" fill="' + hair + '"/><path d="M50 16 V29" stroke="rgba(255,255,255,0.18)" stroke-width="1.6"/>';
      case "curly": // bumpy curls around the crown
        return '<path d="M27 39 Q23 31 29 27 Q28 19 36 20 Q38 13 46 17 Q50 12 55 17 Q63 13 65 20 Q73 19 72 27 Q77 31 73 39 Q66 29 50 29 Q34 29 27 39 Z" fill="' + hair + '"/>';
      default: // short neat cap
        return '<path d="M28 37 Q28 16 50 16 Q72 16 72 37 Q65 27 50 27 Q35 27 28 37 Z" fill="' + hair + '"/>';
    }
  }
  function friend(spec) {
    spec = spec || {};
    const skin = spec.skin || "#e8b98c";
    const hair = spec.hair || "#241a14";
    const shirt = spec.shirt || "#5ec8ff";
    return wrap(
      '<rect x="29" y="60" width="42" height="34" rx="13" fill="' + shirt + '"/>' +
      '<circle cx="26" cy="42" r="4.5" fill="' + skin + '"/><circle cx="74" cy="42" r="4.5" fill="' + skin + '"/>' +
      '<circle cx="50" cy="40" r="24" fill="' + skin + '"/>' +
      hairFor(spec.style, hair) +
      '<circle cx="42" cy="42" r="3" fill="#2a1a12"/><circle cx="58" cy="42" r="3" fill="#2a1a12"/>' +
      '<circle cx="38" cy="49" r="3.4" fill="rgba(255,120,120,0.26)"/><circle cx="62" cy="49" r="3.4" fill="rgba(255,120,120,0.26)"/>' +
      '<path d="M43 50 Q50 56 57 50" stroke="#2a1a12" stroke-width="2.5" fill="none" stroke-linecap="round"/>'
    );
  }

  // "What's Missing?" scenes — each is a set of named parts drawn from basic
  // shapes. fixable(name, without) draws the whole picture EXCEPT the `without`
  // part, so the child spots (and taps) the one that's gone. The part KEYS live
  // in content.js FIXABLE_SCENES (truth-tested); the drawings live here.
  const FIX_PARTS = {
    face: {
      base: '<circle cx="50" cy="52" r="34" fill="#ffe0a3" stroke="#e6b25a" stroke-width="2.5"/>',
      eyes: '<circle cx="39" cy="45" r="5" fill="#2a1a12"/><circle cx="61" cy="45" r="5" fill="#2a1a12"/>',
      nose: '<path d="M50 50 L44 62 H56 Z" fill="#e6a54d"/>',
      mouth: '<path d="M38 68 Q50 80 62 68" stroke="#c0392b" stroke-width="3.4" fill="none" stroke-linecap="round"/>',
    },
    house: {
      base: '<rect x="24" y="46" width="52" height="42" fill="#ffd9a0" stroke="#d9a866" stroke-width="2"/>',
      roof: '<path d="M18 46 L50 20 L82 46 Z" fill="#e0573c"/>',
      door: '<rect x="44" y="64" width="14" height="24" rx="2" fill="#8a5a2b"/>',
      window: '<rect x="30" y="54" width="12" height="12" fill="#bfe6ff" stroke="#6aa9d6" stroke-width="1.5"/>',
    },
    flower: {
      base: '<circle cx="50" cy="40" r="11" fill="#ffd24d" stroke="#e0a800" stroke-width="1.5"/>',
      petals: '<g fill="#ff8fc7">' + [0, 60, 120, 180, 240, 300].map((a) => {
        const rad = a * Math.PI / 180, x = 50 + 20 * Math.cos(rad), y = 40 + 20 * Math.sin(rad);
        return '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="9"/>';
      }).join("") + "</g>",
      stem: '<rect x="47" y="51" width="6" height="36" fill="#5cbf6a"/>',
      leaf: '<ellipse cx="63" cy="70" rx="12" ry="6" fill="#7be08a" transform="rotate(-24 63 70)"/>',
    },
    snowman: {
      base: '<circle cx="50" cy="70" r="20" fill="#f4f9ff" stroke="#c3d4e6" stroke-width="2"/><circle cx="50" cy="40" r="14" fill="#f4f9ff" stroke="#c3d4e6" stroke-width="2"/>' +
        '<path d="M31 66 L14 58 M69 66 L86 58" stroke="#8a5a2b" stroke-width="2.5" stroke-linecap="round"/>' +
        '<circle cx="50" cy="64" r="2.5" fill="#3a4a5a"/><circle cx="50" cy="74" r="2.5" fill="#3a4a5a"/>',
      eyes: '<circle cx="45" cy="37" r="2.6" fill="#2a1a12"/><circle cx="55" cy="37" r="2.6" fill="#2a1a12"/>',
      nose: '<path d="M50 41 L62 44 L50 47 Z" fill="#ff8c33"/>',
      hat: '<rect x="38" y="20" width="24" height="7" rx="1" fill="#333"/><rect x="42" y="8" width="16" height="14" fill="#333"/>',
    },
  };
  function fixable(name, without) {
    const scene = FIX_PARTS[name];
    if (!scene) return wrap("");
    let inner = "";
    // petals/base draw first (behind), then features
    const order = ["stem", "leaf", "base", "petals", "roof", "hat", "window", "door", "eyes", "nose", "mouth"];
    for (const key of order) if (scene[key] && key !== without) inner += scene[key];
    return wrap(inner);
  }

  global.JoshArt = { hero, numberFriend, pup, truck, star, rocket, balloon, home, kid, friend, fixable, shade };
  if (typeof module !== "undefined" && module.exports) module.exports = global.JoshArt;
})(typeof window !== "undefined" ? window : globalThis);
