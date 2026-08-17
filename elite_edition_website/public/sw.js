const CACHE_NAME = 'elite-edition-cache-v' + Date.now();

// Force service worker to activate immediately and take control of the clients
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Fetch event: Network-first for all requests to guarantee zero stale cache
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || !event.request.url.startsWith(self.location.origin)) {
    return;
  }

  // Never cache backend API calls, websocket requests, or HTML documents
  const isHtml = event.request.headers.get('accept')?.includes('text/html');
  if (
    event.request.url.includes('/v1/') || 
    event.request.url.includes('/api/') || 
    event.request.url.includes('socket.io') ||
    isHtml
  ) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }

  // Network-first strategy for static assets
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return networkResponse;
      })
      .catch(() => caches.match(event.request))
  );
});
