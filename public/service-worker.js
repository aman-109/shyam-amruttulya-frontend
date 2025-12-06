self.addEventListener("install", (e) => {
  console.log("Service Worker Installed");
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  console.log("Service Worker Activated");
});

self.addEventListener("fetch", (e) => {
  e.respondWith(
    caches.match(e.request).then((response) => {
      return response || fetch(e.request);
    })
  );
});
