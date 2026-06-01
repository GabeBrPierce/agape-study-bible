/* Agape Study Bible — Service Worker
 * KaiOS 3.0+ compatible (Gecko 84+)
 * KaiOS 4.0: clients.openWindow() replaces clients.openApp()
 *
 * Cache strategy:
 *  - App shell JS/CSS    → pre-cached on activate (parsed from index.html)
 *  - /data/web/**        → pre-cached on activate from web-manifest.json (all 1189 chapters)
 *  - /audio-data/**      → cache-first on demand (large MP3s)
 *  - bible.helloao.org   → network-first, cache fallback
 *  - other same-origin   → stale-while-revalidate
 */

const SHELL_CACHE = 'agape-shell-v1';
const DATA_CACHE  = 'agape-data-v1';

// ── Install ──────────────────────────────────────────────────────────────────
// Minimal — just take over quickly. Real caching happens in activate.
self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

// ── Activate ─────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // 1. Evict stale cache versions
      const CURRENT = new Set([SHELL_CACHE, DATA_CACHE]);
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => !CURRENT.has(k)).map((k) => caches.delete(k)));

      // 2. Take control of all open tabs immediately
      await self.clients.claim();

      // 3. Pre-cache the full app shell (index.html + all JS/CSS it references)
      await preloadShell();

      // 4. Pre-cache all WEB translation chapters in the background
      //    Don't await — this runs without blocking activate
      preloadBibleData();
    })()
  );
});

/**
 * Fetch /index.html, parse out every <script src> and <link href> on the same
 * origin, then cache them all. This runs after every activation so a new build
 * (new hashed filenames) replaces stale cached bundles automatically.
 */
async function preloadShell() {
  try {
    const cache    = await caches.open(SHELL_CACHE);
    const response = await fetch('/index.html', { cache: 'no-store' });
    if (!response.ok) return;

    await cache.put('/index.html', response.clone());
    const html = await response.text();

    // Extract all local asset URLs referenced in the HTML
    const urls = new Set();
    for (const [, src] of html.matchAll(/<script[^>]+src="([^"]+)"/g))  urls.add(src);
    for (const [, href] of html.matchAll(/<link[^>]+href="([^"]+)"/g))  urls.add(href);

    // Filter to same-origin, skip anything that's already a data: or external URL
    const local = [...urls].filter((u) => u.startsWith('/') || u.startsWith(self.location.origin));

    await Promise.all(local.map(async (url) => {
      try {
        const r = await fetch(url, { cache: 'no-store' });
        if (r.ok) await cache.put(url, r);
      } catch { /* ignore individual asset failures */ }
    }));
  } catch { /* offline at activation time — shell will be cached on next online activate */ }
}

/**
 * Pre-cache all WEB translation chapters.
 * Reads the path list from /data/web-manifest.json then batches fetches
 * 20 at a time so we don't hammer the server or exhaust memory.
 * Already-cached entries are skipped, so re-runs are fast.
 */
async function preloadBibleData() {
  try {
    const cache    = await caches.open(DATA_CACHE);
    const res      = await fetch('/data/web-manifest.json');
    if (!res.ok) return;
    const paths    = await res.json();

    const BATCH = 20;
    for (let i = 0; i < paths.length; i += BATCH) {
      const batch = paths.slice(i, i + BATCH);
      await Promise.all(batch.map(async (path) => {
        try {
          // Skip if already cached
          const hit = await cache.match(path);
          if (hit) return;
          const r = await fetch(path);
          if (r.ok) await cache.put(path, r);
        } catch { /* ignore individual failures */ }
      }));
    }
  } catch { /* offline at activation — will retry on next activation */ }
}

// ── Fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  let url;
  try { url = new URL(request.url); } catch { return; }

  // ── 1. Bundled Bible data + audio: cache-first (immutable once built) ──────
  if (
    url.pathname.startsWith('/data/web/') ||
    url.pathname.startsWith('/audio-data/')
  ) {
    event.respondWith(cacheFirst(request, DATA_CACHE));
    return;
  }

  // ── 2. Remote Bible API: network-first, stale cache as fallback ───────────
  if (url.hostname === 'bible.helloao.org') {
    event.respondWith(networkFirst(request, DATA_CACHE));
    return;
  }

  // ── 3. App shell (same origin): stale-while-revalidate ───────────────────
  if (url.origin === self.location.origin) {
    event.respondWith(staleWhileRevalidate(request, SHELL_CACHE));
    return;
  }
});

// ── Strategy helpers ─────────────────────────────────────────────────────────

async function cacheFirst(request, cacheName) {
  const cache  = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    return new Response('Offline', { status: 503, statusText: 'Offline' });
  }
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    return new Response('Offline', { status: 503, statusText: 'Offline' });
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache  = await caches.open(cacheName);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request).then((response) => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  }).catch(() => null);

  if (cached) return cached;

  const fresh = await fetchPromise;
  if (fresh) return fresh;

  if (request.mode === 'navigate') {
    const shell = await cache.match('/index.html');
    if (shell) return shell;
  }

  return new Response('Offline', { status: 503, statusText: 'Offline' });
}

// ── KaiOS 4.0 system messages ─────────────────────────────────────────────────
self.onsystemmessage = (event) => {
  console.log('[SW] systemmessage:', event.data && event.data.type);
};
