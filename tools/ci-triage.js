#!/usr/bin/env node
// 🔧 CI TRIAGE: reads a test run or a job log and says WHAT failed, WHETHER it
// is GitHub's fault or ours, and WHAT to do about it.
//
//   node tools/ci-triage.js test-output.log           (classify a log)
//   node tools/ci-triage.js --jobs jobs.json logs/*.log --status status.json
//                                                     (the deploy report job)
//   node tools/ci-triage.js                           (self-check the signatures)
//
// Why it exists. Every recent red run needed a human to download the log and
// read it, and the two failure kinds want OPPOSITE responses: a test failure is
// ours and is fixed forward, while a publishing failure after green tests
// (2026-11-25: "No artifacts named github-pages", then "Multiple artifacts
// named github-pages" on the re-run) is GitHub's and only wants a retry. Telling
// them apart from a one-line "deploy: failure" took two rounds each time. So
// the classification lives HERE, as code with tests, and the deploy workflow's
// report job runs it on every failed job and writes the verdict to the run's
// summary and to `::error` annotations.
//
// It must never fail the build itself: whatever it reads, it exits 0.
"use strict";
const fs = require("fs");

// Most specific first: the first signature that matches is the verdict.
// `transient` means GitHub or the network, not our code: re-running is the fix.
const SIGNATURES = [
  {
    id: "pages-artifact-duplicate",
    title: "Pages publish: two site artifacts in one run",
    transient: true,
    re: /Multiple artifacts named "github-pages"/,
    action: "A re-run uploaded the site a second time under the same name. The artifact is now named per run attempt, so this should not recur; if it does, start a fresh run (workflow_dispatch) instead of re-running failed jobs.",
  },
  {
    id: "pages-publish",
    title: "Pages publish failed after a good upload (GitHub side)",
    transient: true,
    re: /No artifacts named "github-pages"|Fetching artifact metadata failed|Failed to create deployment|Deployment request failed|Timeout reached, aborting|Error: Deployment failed|getting Pages deployment status|HttpError: (?:Bad Gateway|Service Unavailable|Gateway Timeout|Internal Server Error)/,
    action: "The tests passed and the upload succeeded; GitHub's Pages API refused the deploy. The deploy job already retries three times; re-run the failed jobs once githubstatus.com is green.",
  },
  {
    id: "runner-image",
    title: "The runner image is missing a system library",
    transient: false,
    re: /error while loading shared libraries|Host system is missing dependencies|missing libicu|libxml2\.so\.\d+/,
    action: "Usually the runner image moved under a pinned Playwright (run #527). Keep runs-on pinned, or move the image and Playwright together.",
  },
  {
    id: "browser-install",
    title: "Playwright browsers could not be installed",
    transient: true,
    re: /::error::Playwright browser install failed/,
    action: "The download or apt stalled on every attempt. The install action already retries; re-run once the Playwright CDN and apt mirrors are healthy.",
  },
  {
    id: "npm-install",
    title: "npm ci failed",
    transient: true,
    re: /npm (?:ERR!|error) (?:code|network|errno|syscall|ERESOLVE|request to)/,
    action: "Usually the registry or the network. If package-lock.json changed, check it was committed.",
  },
  {
    id: "live-stale",
    title: "The live site never served this commit",
    transient: true,
    re: /Live site did not fully update/,
    action: "Pages accepted the deploy but the CDN did not serve it within ~5 minutes. Re-run verify-live; if the site still serves an old build, the deploy watchdog will dispatch a fresh deploy.",
  },
  {
    id: "job-timeout",
    title: "A job ran out of time or was cancelled",
    transient: true,
    re: /has exceeded the maximum execution time|The operation was canceled|The job was canceled/,
    action: "Compare the step durations below with the last green run: a step that grew is the cause. A hang in one step holds the pages concurrency group for every push behind it.",
  },
];

// Transport errors. A test that died on one of these is not a product failure.
const NETWORK = /ECONNRESET|ETIMEDOUT|EAI_AGAIN|ENOTFOUND|socket hang up|Peer failed to perform TLS handshake|net::ERR_[A-Z_]+|502 Bad Gateway|503 Service Unavailable/;

// A GitHub job log prefixes every line with its timestamp; TAP does not.
const STAMP = /^\d{4}-\d\d-\d\dT[\d:.]+Z ?/;
const clean = (text) => String(text || "").split(/\r?\n/).map((l) => l.replace(STAMP, ""));

// Node's TAP: `ok N - name` / `not ok N - name` at column 0 for a top-level
// test, then an indented YAML block with duration_ms, location and error.
function parseTap(lines) {
  const tests = [];
  let cur = null, inErr = false;
  for (const l of lines) {
    const m = /^(not ok|ok) \d+ - (.*)$/.exec(l);
    if (m) {
      cur = { name: m[2].replace(/ # (?:SKIP|TODO).*$/, ""), ok: m[1] === "ok", ms: null, file: null, error: null };
      tests.push(cur);
      inErr = false;
      continue;
    }
    if (!cur || !/^ {2}\S/.test(l) && !/^ {4}/.test(l)) { if (!/^ /.test(l)) { cur = null; inErr = false; } continue; }
    let k;
    if ((k = /^ {2}duration_ms: ([\d.]+)/.exec(l))) { cur.ms = +k[1]; inErr = false; continue; }
    if ((k = /^ {2}location: '(.*)'$/.exec(l))) { cur.file = (k[1].match(/([^/\\]+\.test\.js)/) || [])[1] || null; inErr = false; continue; }
    if ((k = /^ {2}error: (.*)$/.exec(l))) {
      const v = k[1];
      if (/^\|[-+]?$/.test(v)) { cur.error = ""; inErr = true; }
      else { cur.error = v.replace(/^'(.*)'$/, "$1").replace(/''/g, "'").replace(/^"(.*)"$/, "$1"); inErr = false; }
      continue;
    }
    if (inErr && /^ {4}/.test(l)) { cur.error += (cur.error ? "\n" : "") + l.slice(4); continue; }
    if (/^ {2}\S/.test(l)) inErr = false;
  }
  const stat = (name) => {
    for (let i = lines.length - 1; i >= 0; i--) {
      const m = new RegExp("^# " + name + " ([\\d.]+)$").exec(lines[i]);
      if (m) return +m[1];
    }
    return null;
  };
  return {
    tests,
    counts: { tests: stat("tests"), pass: stat("pass"), fail: stat("fail"), cancelled: stat("cancelled"), ms: stat("duration_ms") },
  };
}

function classify(text) {
  const lines = clean(text);
  const all = lines.join("\n");
  const tap = parseTap(lines);
  const failing = tap.tests.filter((t) => !t.ok);
  const matches = SIGNATURES.filter((s) => s.re.test(all)).map((s) => s.id);
  let primary;
  const ran = tap.counts.tests > 0 && tap.counts.fail === 0 && !tap.counts.cancelled;
  if (ran && !failing.length) {
    // A green run is judged by its counts, not by text: a passing test may
    // well PRINT a signature (this tool's own tests do).
    primary = { id: "pass", title: "All tests passed", transient: false, action: "Nothing to do." };
  } else if (failing.length) {
    // A failing test outranks a signature that merely appears in the log (a
    // test can PRINT "Multiple artifacts" while checking this very tool). Only
    // when every failure died on a transport error is the run transient.
    const net = failing.every((t) => NETWORK.test(t.error || ""));
    primary = net
      ? { id: "network", title: "Tests died on a network error", transient: true,
          action: "Every failing test hit a transport error, not an assertion. Re-run; if it repeats, check the site or the CDN." }
      : { id: "test-failure", title: `${failing.length} test${failing.length === 1 ? "" : "s"} failed`, transient: false,
          action: "A real failure: reproduce it locally with `node --test --test-name-pattern=\"<name>\" <file>` and fix forward." };
  } else if (matches.length) {
    primary = SIGNATURES.find((s) => s.id === matches[0]);
  } else if (NETWORK.test(all)) {
    primary = { id: "network", title: "A network error", transient: true, action: "Re-run; transient." };
  } else {
    primary = { id: "unknown", title: "No known signature", transient: false,
      action: "Read the raw log. When the cause is found, add its signature to tools/ci-triage.js so the next one is named." };
  }
  const slowest = tap.tests.filter((t) => t.ms != null).sort((a, b) => b.ms - a.ms).slice(0, 5);
  return { primary: { id: primary.id, title: primary.title, transient: primary.transient, action: primary.action },
    matches, failing, counts: tap.counts, slowest };
}

const fmt = (ms) => {
  if (ms == null || !isFinite(ms)) return "—";
  const s = Math.round(ms / 1000);
  return s >= 60 ? Math.floor(s / 60) + "m" + String(s % 60).padStart(2, "0") + "s" : s + "s";
};
const one = (s, n) => String(s || "").replace(/\s+/g, " ").trim().slice(0, n || 240);

// jobs: [{ name, conclusion, started_at, completed_at, steps: [...] }] from the API.
function stepTable(jobs) {
  const rows = [];
  for (const j of jobs || []) {
    for (const s of j.steps || []) {
      if (!s.started_at || !s.completed_at) continue;
      const ms = Date.parse(s.completed_at) - Date.parse(s.started_at);
      if (ms < 15000 && s.conclusion === "success") continue;
      rows.push({ job: j.name, step: s.name, conclusion: s.conclusion, ms });
    }
  }
  return rows;
}

// Components of githubstatus.com's summary.json that a deploy depends on.
function statusNotes(status) {
  const want = /^(Actions|Pages|API Requests|Git Operations|Packages)$/;
  return ((status && status.components) || [])
    .filter((c) => want.test(c.name) && c.status && c.status !== "operational")
    .map((c) => `${c.name}: ${c.status.replace(/_/g, " ")}`);
}

function render(results, opts) {
  opts = opts || {};
  const out = [];
  const jobs = opts.jobs || [];
  out.push("## CI report");
  if (jobs.length) {
    out.push("", "| job | result | time |", "|---|---|---|");
    for (const j of jobs) {
      const ms = j.started_at && j.completed_at ? Date.parse(j.completed_at) - Date.parse(j.started_at) : null;
      out.push(`| ${j.name} | ${j.conclusion || j.status} | ${fmt(ms)} |`);
    }
  }
  const notes = statusNotes(opts.status);
  if (opts.status) out.push("", notes.length ? "**githubstatus.com:** " + notes.join(" · ") : "githubstatus.com: every component a deploy uses is operational.");
  for (const r of results) {
    const c = r.result;
    out.push("", `### ${r.label}: ${c.primary.title}`,
      c.primary.id === "pass" ? "- **Verdict:** `pass`" : `- **Verdict:** \`${c.primary.id}\` — ${c.primary.transient ? "GitHub or the network, not our code: re-run" : "ours: fix forward"}`,
      `- **What to do:** ${c.primary.action}`);
    if (c.counts.tests != null) out.push(`- **Tests:** ${c.counts.pass} passed, ${c.counts.fail} failed, ${c.counts.tests} in all, in ${fmt(c.counts.ms)}`);
    if (c.matches.length) out.push(`- **Signatures seen:** ${c.matches.join(", ")}`);
    for (const t of c.failing.slice(0, 10)) out.push(`- ❌ \`${t.file || "?"}\` **${one(t.name, 160)}** — ${one(t.error, 300) || "(no message)"}`);
    if (c.failing.length > 10) out.push(`- …and ${c.failing.length - 10} more`);
    if (c.slowest.length) out.push(`- **Slowest:** ` + c.slowest.map((t) => `${one(t.name, 60)} ${fmt(t.ms)}`).join(" · "));
  }
  const slow = stepTable(jobs).filter((s) => s.ms > 60 * 60000);
  for (const s of slow) out.push("", `⚠️ ${s.job} / ${s.step} took ${fmt(s.ms)} — over an hour; check it is not creeping toward its timeout.`);
  return out.join("\n") + "\n";
}

// The `::error` annotations GitHub shows on the run page.
function annotations(results) {
  const esc = (s) => String(s).replace(/%/g, "%25").replace(/\r/g, "").replace(/\n/g, "%0A");
  // A PROPERTY (title=, file=) also escapes ":" and "," — unescaped, a test
  // name holding either cuts the title short or invents a property.
  const prop = (s) => esc(s).replace(/:/g, "%3A").replace(/,/g, "%2C");
  const out = [];
  for (const r of results) {
    const c = r.result;
    if (c.primary.id === "pass") continue;
    out.push(`::error title=${prop(r.label + ": " + c.primary.id)}::${esc(c.primary.title + " — " + c.primary.action)}`);
    for (const t of c.failing.slice(0, 10)) {
      out.push(`::error title=${prop("test " + one(t.name, 120))}${t.file ? ",file=tests/" + prop(t.file) : ""}::${esc(String(t.error || "failed").slice(0, 800))}`);
    }
  }
  return out;
}

// Fixtures, each a log a real run produced (trimmed). Run with no arguments to
// prove every signature still recognises what it was written for.
const FIXTURES = [
  ["pages-artifact-duplicate", '2026-11-25T22:17:23.7921013Z ##[error]Error: Multiple artifacts named "github-pages" were unexpectedly found for this workflow run. Artifact count is 2.'],
  ["pages-publish", '2026-11-25T21:53:55.1Z ##[error]Fetching artifact metadata failed. Is githubstatus.com reporting issues with API requests, Pages, or Actions?\n##[error]Error: No artifacts named "github-pages" were found for this workflow run.'],
  ["runner-image", "webkit: error while loading shared libraries: libicu74.so.74: cannot open shared object file"],
  ["browser-install", "::warning::browser install attempt 3 HUNG — killed after 1500s\n::error::Playwright browser install failed 3 times — this is a real failure, not a hang"],
  ["npm-install", "npm error code ECONNRESET\nnpm error network aborted"],
  ["live-stale", "::error::Live site did not fully update to 35cbfb5a within ~5 min"],
  ["job-timeout", "##[error]The job running on runner GitHub Actions 7 has exceeded the maximum execution time of 120 minutes."],
  ["test-failure", "TAP version 13\nnot ok 1 - the bed is on the lane\n  ---\n  duration_ms: 12\n  location: '/w/tests/td.test.js:9:1'\n  error: 'expected 0, got 3'\n  ...\n# tests 1\n# pass 0\n# fail 1"],
  ["network", "TAP version 13\nnot ok 1 - live boots\n  ---\n  error: 'page.goto: net::ERR_CONNECTION_RESET at https://x/'\n  ...\n# tests 1\n# pass 0\n# fail 1"],
  ["unknown", "something nobody has seen before"],
  ["pass", "TAP version 13\nok 1 - logs Multiple artifacts named \"github-pages\" on purpose\n  ---\n  duration_ms: 5\n  ...\n# tests 1\n# pass 1\n# fail 0\n# cancelled 0"],
];

function selfCheck() {
  const wrong = [];
  for (const [want, text] of FIXTURES) {
    const got = classify(text).primary.id;
    if (got !== want) wrong.push(`${want} classified as ${got}`);
  }
  const ids = new Set(SIGNATURES.map((s) => s.id));
  const untested = [...ids].filter((id) => !FIXTURES.some((f) => f[0] === id));
  return { wrong, untested };
}

module.exports = { SIGNATURES, FIXTURES, classify, parseTap, render, annotations, stepTable, statusNotes, selfCheck };

if (require.main === module) {
  try {
    const args = process.argv.slice(2);
    if (!args.length) {
      const { wrong, untested } = selfCheck();
      if (wrong.length || untested.length) {
        console.error("wrong: " + wrong.join("; ") + " | no fixture: " + untested.join(", "));
        process.exit(1);
      }
      console.log(`${SIGNATURES.length} signatures, ${FIXTURES.length} fixtures, all classified`);
      process.exit(0);
    }
    let jobs = [], status = null;
    const files = [];
    for (let i = 0; i < args.length; i++) {
      if (args[i] === "--jobs") jobs = JSON.parse(fs.readFileSync(args[++i], "utf8"));
      else if (args[i] === "--status") { try { status = JSON.parse(fs.readFileSync(args[++i], "utf8")); } catch (e) { status = null; } }
      else files.push(args[i]);
    }
    const results = files.filter((f) => fs.existsSync(f)).map((f) => {
      const text = fs.readFileSync(f, "utf8");
      const label = f.replace(/^.*[\\/]/, "").replace(/\.log$/, "");
      return { label, result: classify(text) };
    });
    const md = render(results, { jobs, status });
    process.stdout.write(md);
    for (const a of annotations(results)) console.log(a);
    if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
    if (process.env.TRIAGE_JSON) fs.writeFileSync(process.env.TRIAGE_JSON, JSON.stringify(results.map((r) => ({ label: r.label, primary: r.result.primary, failing: r.result.failing, counts: r.result.counts })), null, 2));
  } catch (e) {
    // Triage must never be the thing that fails the build.
    console.log("::warning::ci-triage could not run: " + (e && e.message));
  }
  process.exit(0);
}
