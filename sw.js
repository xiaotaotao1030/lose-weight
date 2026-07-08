const cacheName = "light-plan-v1";
const filesToCache = [
  "./",
  "./index.html",
  "./manifest.json",
  "./src/styles/base.css",
  "./src/scripts/app.js",
  "./src/scripts/body-checkin.js",
  "./src/scripts/calculator.js",
  "./src/scripts/daily-record.js",
  "./src/scripts/food-ai.js",
  "./assets/app-icon.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(cacheName).then((cache) => cache.addAll(filesToCache)));
});

self.addEventListener("fetch", (event) => {
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
});
