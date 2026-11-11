// FADEEL OS offline support (service worker).
// - App code, fonts and icons: kept after the first load, so the app opens without internet.
// - Pages: always fetched fresh when online; the last good copy is kept and shown when offline.
// - Never cached: API calls, sign-in pages, and anything that isn't a plain GET.
// - Signing out clears the saved pages from the device.
const VERSION = "v3";
const STATIC = `fos-static-${VERSION}`;
const PAGES = `fos-pages-${VERSION}`;
const OFFLINE = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(STATIC).then((c) => c.addAll([OFFLINE, "/icon-192.png", "/apple-touch-icon.png", "/mark.svg"])));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (!key.endsWith(VERSION)) await caches.delete(key);
      await self.clients.claim();
    })()
  );
});

const NO_CACHE = /^\/(api|login|setup)(\/|$)/;
const pageKey = (url) => {
  const u = new URL(url);
  u.searchParams.delete("_rsc");
  return u.origin + u.pathname + u.search;
};
const cacheable = (res) => res && res.ok && res.type === "basic" && !res.redirected;

async function savePage(url, res) {
  if (!cacheable(res) || NO_CACHE.test(new URL(url).pathname)) return;
  if (!(res.headers.get("content-type") || "").includes("text/html")) return;
  const cache = await caches.open(PAGES);
  await cache.put(pageKey(url), res.clone());
  // also keep the code and styles the page needs, so its buttons work offline even if it was never opened online
  const html = await res.text();
  const assets = [...new Set(html.match(/\/_next\/static\/[^"'\s)\\]+/g) || [])];
  const stat = await caches.open(STATIC);
  await Promise.all(
    assets.map(async (a) => {
      if (await stat.match(a)) return;
      try {
        const r = await fetch(a);
        if (cacheable(r)) await stat.put(a, r);
      } catch {}
    })
  );
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || NO_CACHE.test(url.pathname)) return;

  // hashed build files never change: cache first
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (cacheable(res)) caches.open(STATIC).then((c) => c.put(req, res.clone()));
            return res;
          })
      )
    );
    return;
  }

  // pages: network first, saved copy when offline
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          savePage(req.url, res.clone());
          return res;
        })
        .catch(async () => (await caches.match(pageKey(req.url), { ignoreVary: true, ignoreSearch: false })) || (await caches.match(OFFLINE)) || Response.error())
    );
    return;
  }

  // other files (icons, images): fresh when online, saved copy offline
  if (/\.(png|jpg|jpeg|svg|webp|ico|woff2?)$/.test(url.pathname)) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (cacheable(res)) caches.open(STATIC).then((c) => c.put(req, res.clone()));
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || Response.error()))
    );
  }
});

// messages from the app: download pages for offline use, or forget them on sign-out
self.addEventListener("message", (event) => {
  const msg = event.data || {};
  if (msg.type === "warm" && Array.isArray(msg.paths)) {
    // one at a time with short pauses, so it never competes with what you're doing in the app
    const saveOne = async (p) => {
      try {
        if (/\.(png|jpg|jpeg|svg|webp)$/.test(p)) {
          const res = await fetch(p, { credentials: "same-origin" });
          if (cacheable(res)) await (await caches.open(STATIC)).put(p, res);
        } else {
          const res = await fetch(p, { credentials: "same-origin", headers: { Accept: "text/html" } });
          await savePage(new URL(p, self.location.origin).href, res);
        }
      } catch {}
    };
    event.waitUntil(
      (async () => {
        for (const p of msg.paths) {
          await new Promise((r) => setTimeout(r, 250));
          await saveOne(p);
        }
      })()
    );
  }
  if (msg.type === "clear") event.waitUntil(caches.delete(PAGES));
});
