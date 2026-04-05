const CACHE_NAME = 'alran-academy-v5';
const APP_SHELL = [
  './',
  './index.html',
  './favicon.svg?v=alran-brand-5',
  './manifest.webmanifest?v=alran-brand-5',
  './favicon.png?v=alran-brand-5',
  './apple-touch-icon.png?v=alran-brand-5',
  './pwa-192.png?v=alran-brand-5',
  './pwa-512.png?v=alran-brand-5',
  './logo.jpeg?v=alran-brand-5',
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
        .catch(() => caches.match('./favicon.png?v=alran-brand-5'));
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || self.registration.scope;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const matchingClient = clients.find((client) => client.url === targetUrl || client.url.startsWith(targetUrl));

      if (matchingClient) {
        return matchingClient.focus();
      }

      return self.clients.openWindow(targetUrl);
    }),
  );
});
