// sw.js — offline service worker for m0usunet.
//
// Goal: one online visit precaches the entire game, so from then on
// it runs with the radio off. This is the "load once, play in the
// park with no signal" property — the reason the game already self-
// hosts xterm and never calls a backend at play time.
//
// Strategy: precache the app shell + all kit-content on install, then
// serve everything stale-while-revalidate (instant from cache, refresh
// in the background when online). Content fetches carry a ?bust=<x>
// query (see vfs.js / shell.js); we match with ignoreSearch so the
// clean precached URL satisfies the busted runtime request.
//
// IMPORTANT: bump CACHE_VERSION whenever you change any shipped file.
// A new version name forces a fresh precache and evicts the old cache.
// (Newly *added* files are also caught by the runtime cache after one
// online access, so a stale list degrades gracefully rather than
// breaking offline.)

"use strict";

const CACHE_VERSION = "m0usunet-v9";

// Build the numbered content families the same way vfs.js does, so
// the list scales by editing a count instead of pasting paths.
function numbered(count, nameFn) {
  const out = [];
  for (let i = 1; i <= count; i++) out.push(nameFn(i));
  return out;
}
const pad = (i, n) => String(i).padStart(n, "0");

// Same-origin core. Two entries for the landing page: './' (what a
// navigation actually requests) and 'index.html' (the file GH Pages
// serves there) so the navigate-fallback always has a hit.
const APP_SHELL = [
  "./",
  "index.html",
  "board.html",
  "style.css",
  "mouse.svg",
  "nicks.js",
  "io.js",
  "colorize.js",
  "vfs.js",
  "tool-nmap.js",
  "tool-nikto.js",
  "tool-curl.js",
  "tool-msfconsole.js",
  "shell.js",
  "portal.js",
  "boot.js",
  "vendor/xterm.css",
  "vendor/xterm.js",
  "vendor/xterm-addon-fit.js",
  "vendor/xterm-addon-search.js",
  "vendor/xterm-addon-web-links.js",
];

// Narrative content. These are staged into site/ by CI at deploy time,
// so they exist at the deployed origin even though they aren't in
// site/ locally.
const CONTENT = [
  "kit-content/briefing",
  "kit-content/nmap/brief",
  "kit-content/nmap/hint",
  "kit-content/nikto/advisories",
  "kit-content/nikto/hint",
  "kit-content/msf/brief",
  "kit-content/msf/hint",
  "kit-content/burp/hint",
  ...numbered(20, (i) => `kit-content/burp/req_${pad(i, 3)}.txt`),
  ...numbered(15, (i) => `kit-content/msf/modules/mod_${pad(i, 2)}.txt`),
  ...numbered(8,  (i) => `kit-content/msf/payloads/pay_${pad(i, 2)}.txt`),
  ...numbered(3,  (i) => `kit-content/flags-phase${i}.txt`),
  ...numbered(3,  (i) => `kit-content/phase${i}-done.txt`),
  "build/ic-memo.txt",
];

const PRECACHE = APP_SHELL.concat(CONTENT);

// ── install ──────────────────────────────────────────────────────────
// Precache each URL individually (not cache.addAll) so one missing file
// — e.g. serving site/ locally where kit-content isn't staged — doesn't
// abort the whole install. Missing files are backfilled by the runtime
// cache on first online access.
self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_VERSION);
    await Promise.allSettled(
      PRECACHE.map(async (url) => {
        try {
          const resp = await fetch(url, { cache: "reload" });
          if (resp && resp.status === 200) await cache.put(url, resp);
        } catch (_) { /* offline or blocked — runtime cache covers it */ }
      })
    );
    self.skipWaiting();
  })());
});

// ── activate ─────────────────────────────────────────────────────────
// Drop caches from older versions, then take control of open pages so
// an update applies without a second reload.
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(
      names.filter((n) => n !== CACHE_VERSION).map((n) => caches.delete(n))
    );
    await self.clients.claim();
  })());
});

// ── fetch ────────────────────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_VERSION);

    // Same-origin content is versioned by CACHE_VERSION, so ignore the
    // ?bust= query when matching. Cross-origin (the Google font) keeps
    // its query, which is its identity.
    const cached = await cache.match(req, { ignoreSearch: sameOrigin });

    const network = fetch(req).then((resp) => {
      if (resp && resp.status === 200) cache.put(req, resp.clone());
      return resp;
    }).catch(() => null);

    // Stale-while-revalidate: serve cache immediately, let the network
    // refresh it for next time.
    if (cached) { network; return cached; }

    const fresh = await network;
    if (fresh) return fresh;

    // Offline with nothing cached. For a page load, fall back to the
    // shell so the app still boots and plays from whatever is cached.
    if (req.mode === "navigate") {
      const shell = await cache.match("index.html", { ignoreSearch: true });
      if (shell) return shell;
    }
    return new Response("offline", {
      status: 503,
      statusText: "offline",
      headers: { "Content-Type": "text/plain" },
    });
  })());
});
