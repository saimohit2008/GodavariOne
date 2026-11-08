const CACHE_NAME = 'godavari-one-pwa-v1';

// Safe static core assets to precache on install
const PRECACHE_ASSETS = [
  '/',
  '/offline.html',
  '/manifest.webmanifest',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/icon-maskable-192x192.png',
  '/icons/icon-maskable-512x512.png',
  '/icons/apple-touch-icon.png',
  '/logo.svg',
];

// Install: pre-cache static offline shell and activate immediately
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
      .catch((err) => {
        console.warn('[SW] Precache failed:', err);
      })
  );
});

// Activate: clean up outdated caches from previous deployments
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames.map((name) => {
            if (name !== CACHE_NAME) {
              return caches.delete(name);
            }
          })
        )
      )
      .then(() => self.clients.claim())
  );
});

// Fetch: enforce strict safety policies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. Only intercept HTTP/HTTPS GET requests on the same origin
  if (request.method !== 'GET' || url.protocol.indexOf('http') !== 0) {
    return;
  }

  // 2. STRICT SECURITY GATE: Never cache backend APIs, authentication, OTP, bookings,
  // profile data, or live crowd status.
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/verify-email') ||
    url.searchParams.has('token') ||
    url.searchParams.has('code')
  ) {
    return; // Pass through directly to network
  }

  // 3. Navigation requests (HTML pages): Network-first with offline fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // If successful, cache a copy of the homepage for fast offline shell
          if (response && response.status === 200 && url.pathname === '/') {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          const offlinePage = await caches.match('/offline.html');
          return (
            offlinePage ||
            new Response('Offline - Godavari One', {
              headers: { 'Content-Type': 'text/html' },
            })
          );
        })
    );
    return;
  }

  // 4. Static assets (/_next/static/, /icons/, images, fonts, styles):
  // Cache-first with network fallback
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.endsWith('.woff2') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.ico') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.js')
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) {
          return cached;
        }
        return fetch(request)
          .then((response) => {
            if (response && response.status === 200 && response.type === 'basic') {
              const copy = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
            }
            return response;
          })
          .catch(() => {
            return new Response('', { status: 408 });
          });
      })
    );
  }
});

