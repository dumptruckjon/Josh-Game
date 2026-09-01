// Shared helpers for the Playwright browser tests: locate a browser binary and
// serve the site (locally, or point at a live URL via JOSH_BASE_URL).

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { chromium, webkit } = require("playwright");

const ROOT = path.join(__dirname, "..");
const MIME = {
  ".html": "text/html", ".css": "text/css", ".js": "text/javascript",
  ".svg": "image/svg+xml", ".json": "application/json",
  ".webmanifest": "application/manifest+json", ".png": "image/png",
};

// Prefer the browser Playwright expects; otherwise scan the preinstalled dir.
function findExecutable(prefix) {
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH || "/opt/pw-browsers";
  if (!fs.existsSync(base)) return null;
  for (const dir of fs.readdirSync(base)) {
    if (!new RegExp(`^${prefix}`).test(dir)) continue;
    for (const rel of [
      "chrome-linux/chrome", "chrome-linux64/chrome", "chrome-linux/headless_shell",
      "pw_run.sh", "minibrowser-gtk/MiniBrowser",
    ]) {
      const cand = path.join(base, dir, rel);
      if (fs.existsSync(cand)) return cand;
    }
  }
  return null;
}

function findChromium() {
  try {
    const p = chromium.executablePath();
    if (p && fs.existsSync(p)) return p;
  } catch (_) { /* ignore */ }
  return findExecutable("chromium");
}

// Is a real WebKit (Safari engine) browser available to launch?
function webkitAvailable() {
  try {
    const p = webkit.executablePath();
    return !!(p && fs.existsSync(p));
  } catch (_) {
    return false;
  }
}

// Start a local static server — UNLESS JOSH_BASE_URL is set, in which case tests
// run against that live URL and no server is started.
async function startServer(root = ROOT) {
  if (process.env.JOSH_BASE_URL) {
    return { server: null, baseURL: process.env.JOSH_BASE_URL };
  }
  // Optional per-test request hijack (e.g. simulate a captive portal answering
  // 200 text/html for a script URL). setHijack(fn) — fn(req) returns
  // {status, type, body} to override, or falsy to serve normally.
  let hijack = null;
  const server = http.createServer((req, res) => {
    if (hijack) {
      const h = hijack(req);
      if (h) {
        res.statusCode = h.status || 200;
        res.setHeader("Content-Type", h.type || "text/html");
        return res.end(h.body || "");
      }
    }
    let urlPath = decodeURIComponent(req.url.split("?")[0]);
    if (urlPath === "/") urlPath = "/index.html";
    const file = path.join(root, urlPath);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.statusCode = 404;
      return res.end("not found");
    }
    res.setHeader("Content-Type", MIME[path.extname(file)] || "application/octet-stream");
    fs.createReadStream(file).pipe(res);
  });
  await new Promise((r) => server.listen(0, r));
  const port = server.address().port;
  // HARD-offline support (audit: Playwright's setOffline does NOT gate
  // service-worker fetches — 25 SW requests reached this server during an
  // "offline" reload, so an offline test could pass while offline was broken).
  // pause() closes the listener AND destroys live sockets so every request —
  // including the SW's — really fails; resume() re-listens on the same port.
  const sockets = new Set();
  server.on("connection", (s) => { sockets.add(s); s.on("close", () => sockets.delete(s)); });
  const pause = () => new Promise((r) => { server.close(() => r()); for (const s of sockets) s.destroy(); });
  const resume = () => new Promise((r) => server.listen(port, r));
  const setHijack = (fn) => { hijack = fn; };
  return { server, baseURL: `http://localhost:${port}/`, pause, resume, setHijack };
}

// A page navigation is the ONE place these tests touch a network they do not
// control. Against a local server that is in-process and reliable; against the
// LIVE site (JOSH_BASE_URL, the verify-live job) it is a CDN, and a CDN resets
// sockets. Run #365 died on
//   "page.goto: Peer failed to perform TLS handshake: Connection reset by peer"
// in the two heaviest live tests — the ones that walk 240 games at two viewports,
// so they make hundreds of navigations and are the first to be hit. `test` and
// `deploy` had both passed, so the site was live and correct and the red said
// otherwise.
//   That erodes what a red verify-live MEANS, which is the same argument the
// bounded `playwright install` retry was built on: a transient becomes a retry, a
// real failure stays a fast, visible red. Every attempt is announced, so a retry
// is never silent, and the error is re-thrown unchanged once the attempts are
// spent — a site that is genuinely down still fails, and fails saying why.
const NAV_ATTEMPTS = 3;
// Only transport-level failures are retried. An assertion, a page error, a 404
// or a timeout waiting for content is a REAL failure and must not be masked —
// retrying those would turn this from a flake filter into a bug filter.
const TRANSIENT = /TLS handshake|Connection reset|ECONNRESET|ECONNREFUSED|EPIPE|socket hang up|net::ERR_(CONNECTION|NETWORK|SOCKET|EMPTY_RESPONSE)/i;

// A navigation can SUCCEED and still leave the page half-built: `goto` resolves
// on `load`, and a `<script defer>` whose fetch failed fires no error anybody is
// listening for, so the page boots with that file's globals simply absent. That
// is not hypothetical — a live run went red on FIVE assertions about 华丽's
// world, all of them saying she had 20 games instead of 40, because
// `games-hl-a.js` (exactly one of her two files) never arrived from the CDN
// edge. Nothing in the failure named a script; the deploy's own pre-flight had
// already fetched every versioned asset and got 200 for each, seconds earlier,
// from a different connection.
//
// Which SCRIPTS: derived from the page, never a list — the same reason the
// precache scan reads `<script src>` out of index.html rather than naming files.
// A script that ran has a same-origin Resource Timing entry with a real decoded
// body; one that never arrived has no entry, or an empty one. Both engines
// expose the size for same-origin resources, and cache hits still report their
// decoded size, so a warm load is not a false positive.
async function missingScripts(page) {
  try {
    return await page.evaluate(() => {
      const here = location.origin;
      const timed = new Map();
      for (const e of performance.getEntriesByType("resource")) {
        if (e.initiatorType === "script" || /\.js(\?|$)/.test(e.name)) {
          timed.set(e.name.split("#")[0], (timed.get(e.name.split("#")[0]) || 0) + (e.decodedBodySize || 0));
        }
      }
      const out = [];
      let seen = 0;
      for (const el of document.querySelectorAll("script[src]")) {
        const abs = new URL(el.getAttribute("src"), location.href);
        if (abs.origin !== here) continue;                 // a CDN script is not ours to police
        const got = timed.get(abs.href.split("#")[0]);
        if (got) seen++; else out.push(abs.pathname + abs.search);
      }
      // SELF-VERIFYING, and it decides the failure DIRECTION. Resource Timing
      // sizes are an engine feature, and WebKit is not installed in the dev
      // sandbox — so a browser that reports no body for anything must make this
      // check a NO-OP, never a machine that flags all 26 scripts and then fails
      // the run three retries later. If nothing at all reported a body, the
      // mechanism is unavailable here and there is nothing to say.
      return seen ? out : [];
    });
  } catch (_) {
    return [];   // no page to ask (a closed context) is not a missing script
  }
}

function retryNavigation(page) {
  const real = page.goto.bind(page);
  page.goto = async function (url, opts) {
    let last;
    for (let i = 1; i <= NAV_ATTEMPTS; i++) {
      try {
        const res = await real(url, opts);
        // …and then the same question one layer down. A script that fetched
        // NOTHING is the transport shape, so it is retried exactly like a
        // connection that never opened — and a script genuinely missing from
        // the build fails every attempt and is then named, which is strictly
        // better than the five downstream assertions it used to produce.
        const gone = await missingScripts(page);
        if (!gone.length) return res;
        last = new Error(`the page loaded but these scripts did not run: ${gone.join(", ")}`);
        if (i === NAV_ATTEMPTS) break;
        console.warn(`  ⚠️  ${url} booted without ${gone.join(", ")} — ` +
          `attempt ${i} of ${NAV_ATTEMPTS}, retrying`);
        await new Promise((r) => setTimeout(r, 1000 * i));
        continue;
      } catch (err) {
        last = err;
        if (!TRANSIENT.test(String(err && err.message))) throw err;   // a real failure, unmasked
        if (i === NAV_ATTEMPTS) break;
        console.warn(`  ⚠️  navigation to ${url} failed (${String(err.message).split("\n")[0]}) — ` +
          `attempt ${i} of ${NAV_ATTEMPTS}, retrying`);
        await new Promise((r) => setTimeout(r, 1000 * i));
      }
    }
    throw last;
  };
  return page;
}

// Wrap the BROWSER, not the call sites: there are 14 `page.goto`s across four
// files and six places that build a page, so a per-call-site helper is a list
// someone forgets to join. A page made from a wrapped browser inherits the retry
// however it was made.
function withNavRetries(browser) {
  if (!browser || browser.__navRetries) return browser;
  browser.__navRetries = true;
  const newPage = browser.newPage.bind(browser);
  browser.newPage = async (...a) => retryNavigation(await newPage(...a));
  const newContext = browser.newContext.bind(browser);
  browser.newContext = async (...a) => {
    const ctx = await newContext(...a);
    const ctxNewPage = ctx.newPage.bind(ctx);
    ctx.newPage = async (...b) => retryNavigation(await ctxNewPage(...b));
    return ctx;
  };
  return browser;
}

async function launchBrowser() {
  const executablePath = findChromium();
  return withNavRetries(await chromium.launch({
    args: ["--no-sandbox", "--use-gl=swiftshader"],
    ...(executablePath ? { executablePath } : {}),
  }));
}

// For mobile tests: real WebKit (Safari engine) when installed, else Chromium.
async function launchMobileBrowser() {
  if (webkitAvailable()) {
    return { browser: withNavRetries(await webkit.launch()), engine: "webkit" };
  }
  const executablePath = findChromium();
  return {
    browser: withNavRetries(await chromium.launch({
      args: ["--no-sandbox", "--use-gl=swiftshader"],
      ...(executablePath ? { executablePath } : {}),
    })),
    engine: "chromium",
  };
}

module.exports = {
  findChromium, webkitAvailable, startServer, launchBrowser, launchMobileBrowser, ROOT,
  missingScripts,
  withNavRetries, NAV_ATTEMPTS, TRANSIENT,
};
