/* global self, caches, URL, fetch */
const CACHE = "sinur-public-v1";
const PUBLIC_ASSETS = ["/offline.html", "/icons/icon.svg"];
self.addEventListener("install", event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(PUBLIC_ASSETS))));
self.addEventListener("activate", event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))));
self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (PUBLIC_ASSETS.includes(url.pathname)) {
    event.respondWith(caches.match(request).then(cached => cached || fetch(request)));
    return;
  }
  if (request.mode === "navigate") event.respondWith(fetch(request).catch(() => caches.match("/offline.html")));
});
