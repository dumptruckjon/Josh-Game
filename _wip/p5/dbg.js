// node dbg.js <tryname> <id>: play the bot and report where it gets stuck
const path = require("path");
const D = path.join(__dirname, "try", process.argv[2], "scripts");
const L = require(path.join(D, "hole-logic.js"));
const id = process.argv[3];
const b = L.createGame(id);
let last = 0;
while (!b.done && b.t < 400) {
  if (!b.won) { const tg = L.botTarget(b); if (tg) L.setTarget(b, tg.x, tg.y); }
  L.step(b, L.DT);
  b.events.length = 0;
  if (b.t - last > 50) { last = b.t; console.log("t", b.t.toFixed(0), "lvl", b.hole.level, "eaten", b.eaten, "at", Math.round(b.hole.x), Math.round(b.hole.y), "unlocked", JSON.stringify(b.unlocked)); }
}
const tg = L.botTarget(b);
console.log("target", tg && JSON.stringify({ x: Math.round(tg.x), y: Math.round(tg.y), e: tg.o && tg.o.e }));
const left = {};
for (const o of b.objects) if (o.st === L.IDLE) { const k = o.e + " t" + o.tier + (o.key ? " key" : "") + (o.lock ? " lock" : "") + (o.ride ? " ride" : ""); left[k] = (left[k] || 0) + 1; }
console.log("left", JSON.stringify(left));
const keys = b.objects.filter((o) => o.key).map((o) => [o.e, Math.round(o.x), Math.round(o.y), o.st]);
console.log("keys", JSON.stringify(keys));
