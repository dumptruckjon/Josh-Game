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

function retryNavigation(page) {
  const real = page.goto.bind(page);
  page.goto = async function (url, opts) {
    let last;
    for (let i = 1; i <= NAV_ATTEMPTS; i++) {
      try {
        return await real(url, opts);
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
  withNavRetries, NAV_ATTEMPTS, TRANSIENT,
};
