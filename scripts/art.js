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

  // A friendly masked spider-hero (red = Spidey, pink = Ghost-Spider, blue = Spin).
  function hero(color) {
    color = color || "#e23636";
    return wrap(
      '<ellipse cx="50" cy="80" rx="24" ry="18" fill="' + color + '"/>' +
      '<circle cx="50" cy="42" r="30" fill="' + color + '"/>' +
      '<path d="M50 12 V72 M20 42 H80 M28 22 L72 62 M72 22 L28 62" stroke="rgba(0,0,0,0.16)" stroke-width="1.1" fill="none"/>' +
      '<path d="M30 40 Q34 28 46 34 Q44 47 32 46 Z" fill="#fff" stroke="#111" stroke-width="1.6"/>' +
      '<path d="M70 40 Q66 28 54 34 Q56 47 68 46 Z" fill="#fff" stroke="#111" stroke-width="1.6"/>' +
      '<path d="M40 56 Q50 64 60 56" stroke="#111" stroke-width="2.6" fill="none" stroke-linecap="round"/>'
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
  function pup(collar) {
    collar = collar || "#e23636";
    return wrap(
      '<ellipse cx="24" cy="40" rx="12" ry="20" fill="#b98a5e"/>' +
      '<ellipse cx="76" cy="40" rx="12" ry="20" fill="#b98a5e"/>' +
      '<circle cx="50" cy="46" r="30" fill="#e3b781"/>' +
      '<circle cx="40" cy="42" r="4" fill="#3a2a15"/><circle cx="60" cy="42" r="4" fill="#3a2a15"/>' +
      '<ellipse cx="50" cy="58" rx="14" ry="10" fill="#f4e2c8"/>' +
      '<ellipse cx="50" cy="53" rx="4.5" ry="3.2" fill="#3a2a15"/>' +
      '<path d="M46 62 Q50 71 54 62 Z" fill="#ff8fa3"/>' +
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

  function rocket() {
    return wrap(
      '<path d="M50 8 C64 22 66 44 60 62 H40 C34 44 36 22 50 8 Z" fill="#eceff4" stroke="#c7ced9" stroke-width="1.5"/>' +
      '<circle cx="50" cy="34" r="8" fill="#5ec8ff" stroke="#2b6cff" stroke-width="2"/>' +
      '<polygon points="40,54 26,68 40,64" fill="#e23636"/><polygon points="60,54 74,68 60,64" fill="#e23636"/>' +
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

  global.JoshArt = { hero, numberFriend, pup, truck, star, rocket, balloon, home, kid, friend };
  if (typeof module !== "undefined" && module.exports) module.exports = global.JoshArt;
})(typeof window !== "undefined" ? window : globalThis);
