// Unit tests for scripts/art.js — the original homage SVG art. Ensures every
// character returns a well-formed <svg> string (so it renders, not breaks).

const test = require("node:test");
const assert = require("node:assert");
const ART = require("../scripts/art.js");

test("every character returns a well-formed 100x100 svg string", () => {
  const samples = {
    hero: ART.hero("#e23636"),
    numberFriend: ART.numberFriend(5, "#5ec8ff"),
    pup: ART.pup("#2b6cff"),
    truck: ART.truck(),
    star: ART.star(),
    rocket: ART.rocket(),
    balloon: ART.balloon(),
    home: ART.home(),
    kid: ART.kid("#e8b98c", "#7be08a"),
  };
  for (const [name, s] of Object.entries(samples)) {
    assert.ok(typeof s === "string" && s.startsWith("<svg") && s.endsWith("</svg>"), `${name} should be an svg string`);
    assert.ok(s.includes('viewBox="0 0 100 100"'), `${name} uses the 100x100 viewBox`);
    // roughly balanced angle brackets (no truncated tags)
    const open = (s.match(/</g) || []).length;
    const close = (s.match(/>/g) || []).length;
    assert.equal(open, close, `${name} has balanced tag brackets`);
  }
});

test("numberFriend draws exactly n cubes for n = 1..10 (and clamps out of range)", () => {
  for (let n = 1; n <= 10; n++) {
    const cubes = (ART.numberFriend(n, "#5ec8ff").match(/<rect /g) || []).length;
    assert.equal(cubes, n, `n=${n} should draw n cubes`);
  }
  assert.equal((ART.numberFriend(0).match(/<rect /g) || []).length, 1, "clamps to >= 1");
  assert.equal((ART.numberFriend(99).match(/<rect /g) || []).length, 10, "clamps to <= 10");
});
