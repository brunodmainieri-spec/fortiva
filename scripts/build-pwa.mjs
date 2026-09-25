import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

// Only public fallback assets enter Cache Storage. Auth responses, HTML
// navigations, API responses, photos and user records are never cached here.
const assets = ["/offline.html", "/icons/icon-192.png"];
const hash = createHash("sha256");
for (const path of ["/index.html", ...assets])
  hash.update(await readFile("dist" + path));
const cache = "fortiva-offline-" + hash.digest("hex").slice(0, 16);
const source = `
const CACHE = ${JSON.stringify(cache)};
const ASSETS = ${JSON.stringify(assets)};
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
});
// The new version waits for existing windows to close. No forced reloads
// while someone is filling a form or recording a workout.
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith('fortiva-offline-') && key !== CACHE) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(async () => {
      const cache = await caches.open(CACHE);
      return (await cache.match('/offline.html')) || Response.error();
    }));
  } else if (ASSETS.includes(url.pathname) && !url.search) {
    event.respondWith(caches.open(CACHE).then(async cache => (await cache.match(request)) || fetch(request)));
  }
});
`;
await writeFile("dist/sw.js", source.trim() + "\n");
console.log("PWA service worker generated: " + cache);
