const CACHE_NAME = 'aren-academy-v11';
const APP_SHELL = [
  './',
  './index.html',
  './favicon.svg?v=aren-brand-9',
  './manifest.webmanifest?v=aren-brand-9',
  './favicon.png?v=aren-brand-9',
  './apple-touch-icon.png?v=aren-brand-9',
  './pwa-192.png?v=aren-brand-9',
  './pwa-512.png?v=aren-brand-9',
  './logo.jpeg?v=aren-brand-9',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return;
  }

  const requestUrl = new URL(event.request.url);

  if (requestUrl.origin !== self.location.origin) {
    return;
  }

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('./index.html', responseClone));
          return response;
        })
        .catch(() => caches.match('./index.html')),
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse.ok && networkResponse.type === 'basic') {
            const networkClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkClone));
          }

          return networkResponse;
        })
        .catch(() => caches.match('./favicon.png?v=aren-brand-9'));
    }),
  );
});
