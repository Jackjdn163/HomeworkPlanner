const CACHE_NAME = "homework-planner-ai-v20260508-expansion";
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./css/main.css?v=20260508-expansion",
  "./css/layout.css?v=20260508-expansion",
  "./css/timeline.css?v=20260508-expansion",
  "./css/components.css?v=20260508-expansion",
  "./js/storage.js?v=20260508-expansion",
  "./js/schedule.js?v=20260508-expansion",
  "./js/planner-plus.js?v=20260508-expansion",
  "./js/assignments.js?v=20260508-expansion",
  "./js/busy.js?v=20260508-expansion",
  "./js/rendering.js?v=20260508-expansion",
  "./js/calendar.js?v=20260508-expansion",
  "./js/ai.js?v=20260508-expansion",
  "./js/auth.js?v=20260508-expansion",
  "./js/app.js?v=20260508-expansion",
  "./vendor/supabase.js?v=20260508-expansion",
  "./supabase-config.js?v=20260508-expansion",
  "./assets/logos/logo.png",
  "./assets/icons/add.svg",
  "./assets/icons/delete.svg",
  "./assets/icons/timer.svg",
  "./assets/sounds/complete.mp3",
  "./assets/sounds/notification.mp3"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(CORE_ASSETS))
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    )
  );
});

self.addEventListener("fetch", event => {
  if(event.request.method !== "GET"){
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if(cachedResponse){
        return cachedResponse;
      }

      return fetch(event.request)
        .then(networkResponse => {
          if(
            networkResponse &&
            networkResponse.status === 200 &&
            new URL(event.request.url).origin === self.location.origin
          ){
            const responseClone = networkResponse.clone();

            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseClone);
            });
          }

          return networkResponse;
        })
        .catch(() => caches.match("./index.html"));
    })
  );
});
