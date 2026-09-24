// Immediate self-destruction if service worker runs on raw IP address
if (self.location.hostname === '3.7.174.180' || /^(\d{1,3}\.){3}\d{1,3}$/.test(self.location.hostname)) {
  self.addEventListener('install', () => self.skipWaiting());
  self.addEventListener('activate', (event) => {
    event.waitUntil(
      caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))).then(() => {
        return self.registration.unregister();
      }).then(() => {
        return self.clients.matchAll({ type: 'window' }).then((clients) => {
          clients.forEach((client) => {
            const url = new URL(client.url);
            client.navigate('https://erp.eliteedition.in' + url.pathname + url.search + url.hash);
          });
        });
      })
    );
  });
}

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

  // Never cache backend API calls, websocket requests, or HTML/navigation documents
  const isHtml = event.request.headers.get('accept')?.includes('text/html') ||
                 event.request.mode === 'navigate' ||
                 event.request.destination === 'document';
  if (
    event.request.url.includes('/v1/') || 
    event.request.url.includes('/api/') || 
    event.request.url.includes('socket.io') ||
    event.request.url.includes('version.json') ||
    isHtml
  ) {
    return;
  }

  // Network-first strategy for static assets with safe fallback
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return networkResponse;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        return new Response('', { status: 408, statusText: 'Request Timeout' });
      })
  );
});
