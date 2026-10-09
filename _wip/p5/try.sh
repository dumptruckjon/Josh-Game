#!/bin/bash
# try.sh <name> <draft.js>... — splice draft places into a PRIVATE copy of the
# game and check them: tools/hole-check.js on the drafted ids, then the whole
# node engine suite. Never touches the real tree, so several authors can run
# it at once (each with its own <name>).
set -u
SP=/tmp/claude-0/-home-user-Josh-Game/881f4676-c717-5343-8764-48b71519bc4b/scratchpad/p5
REPO=/home/user/Josh-Game
name=$1; shift
D=$SP/try/$name
rm -rf "$D"; mkdir -p "$D"
cp -r "$REPO/scripts" "$REPO/tests" "$REPO/tools" "$REPO/styles" "$REPO/package.json" "$D/"
cp "$REPO"/*.html "$D/" 2>/dev/null
node - "$D/scripts/hole-data.js" "$@" <<'JS'
const fs = require("fs");
const [file, ...drafts] = process.argv.slice(2);
let s = fs.readFileSync(file, "utf8");
const a = s.indexOf("const SCENES = [");
const b = s.indexOf("\n  ];", a);
if (a < 0 || b < 0) throw new Error("cannot find SCENES");
// A draft whose id is already a place REPLACES that place (an upgrade to an
// existing place); any other draft is appended to the end of SCENES.
const texts = drafts.map((f) => fs.readFileSync(f, "utf8").replace(/\s+$/, "")).map((t) => t.endsWith(",") ? t : t + ",");
const add = [];
for (const t of texts) {
  const id = (t.match(/id:\s*"([a-z0-9]+)"/) || [])[1];
  const at = s.indexOf('id: "' + id + '"', a);
  if (id && at > 0 && at < s.indexOf("\n  ];", a)) {
    const open = s.lastIndexOf("\n    {\n", at);
    const close = s.indexOf("\n    },\n", at);
    if (open < 0 || close < 0) throw new Error("cannot find the scene " + id);
    s = s.slice(0, open + 1) + t.replace(/^\s*\n/, "") + s.slice(close + "\n    },".length);
    console.error("replaced " + id);
  } else add.push(t);
}
const b2 = s.indexOf("\n  ];", a);
s = s.slice(0, b2) + (add.length ? "\n" + add.join("\n") : "") + s.slice(b2);
fs.writeFileSync(file, s);
JS
cd "$D" || exit 1
node --check scripts/hole-data.js || exit 1
ids=$(node -e 'const fs=require("fs");const ids=[];for(const f of process.argv.slice(1)){const m=fs.readFileSync(f,"utf8").match(/id:\s*"([a-z0-9]+)"/);if(m)ids.push(m[1]);}console.log(ids.join(","))' "$@")
echo "=== hole-check $ids"
timeout 600 node tools/hole-check.js "$ids"
[ -n "${FAST:-}" ] && exit 0
echo "=== node engine suite (failures only)"
timeout 900 node --test tests/hole-logic.test.js > "$D/suite.log" 2>&1
grep -E "^# (tests|pass|fail)" "$D/suite.log"
awk '/^not ok/{p=1} p{print} /^  \.\.\./{p=0}' "$D/suite.log" | grep -E "^not ok|error:|^    [a-z]" | head -60
