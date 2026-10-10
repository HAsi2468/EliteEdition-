// Service Worker for Elite Edition Enterprise ERP
// High performance, offline-capable PWA with strict company data isolation
const CACHE_VERSION = 'v2.1.0';
const STATIC_CACHE = `elite-erp-static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `elite-erp-runtime-${CACHE_VERSION}`;

// Host protection: unregister and redirect if accessed on raw IP address
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

// App shell assets to precache during install
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.webmanifest',
  '/Logo.png',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/pwa-maskable-192x192.png',
  '/pwa-maskable-512x512.png',
  '/apple-touch-icon.png',
  '/fonts/inter-400.woff2',
  '/fonts/inter-500.woff2',
  '/fonts/inter-600.woff2'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== STATIC_CACHE && key !== RUNTIME_CACHE)
            .map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// Support manual reload update trigger from client
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Only handle GET requests
  if (request.method !== 'GET') {
    return;
  }

  // 1. STRICT NETWORK-ONLY: Never cache any authenticated API, dynamic backend data,
  // company invoices/transactions, socket connections, or version check endpoints
  const isApi = url.pathname.startsWith('/v1/') ||
                url.pathname.startsWith('/api/') ||
                url.pathname.includes('socket.io') ||
                url.pathname.includes('version.json') ||
                url.searchParams.has('company_id') ||
                url.searchParams.has('company') ||
                request.headers.has('Authorization');

  if (isApi) {
    event.respondWith(
      fetch(request).catch(() => {
        return new Response(JSON.stringify({ 
          error: 'Network offline', 
          message: 'You are currently offline. Check your internet connection.' 
        }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }

  // 2. NAVIGATION REQUESTS (HTML page loads)
  // Network-first to deliver latest app shell; fallback to cached shell; fallback to offline.html
  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
          }
          return networkResponse;
        })
        .catch(async () => {
          const cached = await caches.match(request) || await caches.match('/index.html') || await caches.match('/');
          if (cached) return cached;
          const offlinePage = await caches.match('/offline.html');
          if (offlinePage) return offlinePage;
          return new Response('Offline', { status: 503, statusText: 'Offline' });
        })
    );
    return;
  }

  // 3. STATIC ASSETS (JS, CSS, Images, Fonts)
  // Stale-While-Revalidate: return fast cached asset, update cache in background
  if (
    url.origin === self.location.origin ||
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com') ||
    url.hostname.includes('cdn.jsdelivr.net')
  ) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        const fetchPromise = fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy));
          }
          return networkResponse;
        }).catch(() => {
          // Network failure silently handled when serving cached version
        });

        return cachedResponse || fetchPromise;
      })
    );
  }
});

// ==============================================================================
// 4. WEB PUSH NOTIFICATION ENGINE
// Delivers system-level desktop/mobile alerts when tabs are backgrounded or closed
// ==============================================================================

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch (e) {
    payload = { title: 'Elite ERP', body: event.data.text() };
  }

  const payloadData = payload.data || {};
  const destinationUrl = payloadData.url || (payloadData.roomId ? `/communication?room=${payloadData.roomId}` : '/communication');
  const tag = payload.tag || payloadData.tag || 'erp-message';

  const title = payload.title || 'Elite ERP Notification';
  const notificationOptions = {
    body: payload.body || 'You received a new update.',
    icon: payload.icon || '/Logo.png',
    badge: payload.badge || '/Logo.png',
    tag: tag, // Collapses multiple alerts gracefully per thread without tray spam
    renotify: payload.renotify !== undefined ? payload.renotify : true,
    data: {
      ...payloadData,
      url: destinationUrl,
    },
    vibrate: payload.priority === 'urgent' ? [200, 100, 200, 100, 400] : [100, 50, 100],
    actions: payload.actions || [
      { action: 'open', title: 'Open' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
  };

  // Smart Focus & In-Tab Suppression:
  // If the user already has an active, focused tab viewing this room, broadcast in-tab alert without external OS modal
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      const targetRoomId = payloadData.roomId;

      const isRoomFocused = clientList.some((client) => {
        return (
          client.visibilityState === 'visible' &&
          client.focused &&
          targetRoomId &&
          client.url.includes(`room=${targetRoomId}`)
        );
      });

      if (isRoomFocused) {
        clientList.forEach((c) => c.postMessage({ type: 'IN_APP_MESSAGE_ALERT', payload }));
        return;
      }

      return self.registration.showNotification(title, notificationOptions);
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  // 1. Intercept and close notification immediately
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  const destinationUrl = event.notification.data?.url || '/communication';
  const targetUrl = new URL(destinationUrl, self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // 2. Query existing clients: if matching window exists, focus and postMessage to route
      for (const client of clientList) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          client.focus();
          client.postMessage({
            type: 'NAVIGATE_TO_ROUTE',
            url: destinationUrl,
            data: event.notification.data,
          });
          if ('navigate' in client && client.url !== targetUrl) {
            client.navigate(targetUrl);
          }
          return;
        }
      }

      // 3. Otherwise, launch the target URL in a new standalone/browser window
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

