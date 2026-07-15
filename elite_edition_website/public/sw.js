const CACHE_NAME = 'elite-edition-cache-v1';

// Force service worker to activate immediately and take control of the clients
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event: Serve cached assets first, update the cache in the background
self.addEventListener('fetch', (event) => {
  // Only intercept GET requests belonging to the app shell
  if (event.request.method !== 'GET' || !event.request.url.startsWith(self.location.origin)) {
    return;
  }

  // Do not cache backend API calls or real-time websocket requests
  if (
    event.request.url.includes('/v1/') || 
    event.request.url.includes('/api/') || 
    event.request.url.includes('socket.io')
  ) {
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.match(event.request).then((cachedResponse) => {
        // Fetch from network and update the cache
        const fetchPromise = fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          })
          .catch(() => {
            // Silently handle offline/network errors
          });

        // Instantly return the cached response, fallback to the network promise if not cached
        return cachedResponse || fetchPromise;
      });
    })
  );
});
