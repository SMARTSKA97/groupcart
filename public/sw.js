const CACHE_NAME = 'groupcart-cache-v4';
const ASSETS = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/utils.js',
  '/js/api.js',
  '/js/auth.js',
  '/js/user.js',
  '/js/admin.js',
  '/js/app.js',
  '/manifest.json',
  '/groupcart_icon.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      for (const url of ASSETS) {
        try {
          const response = await fetch(url);
          if (!response.ok) continue;

          const contentType = response.headers.get('content-type') || '';
          
          // Safeguard: if a JS or CSS file returns HTML, it means localtunnel/proxy intercepted it.
          // Do NOT cache it, otherwise the app will crash on syntax errors.
          if ((url.endsWith('.js') && contentType.includes('text/html')) ||
              (url.endsWith('.css') && contentType.includes('text/html'))) {
            console.warn(`[SW] Ignored caching for ${url} due to content-type mismatch (HTML returned for code).`);
            continue;
          }

          await cache.put(url, response);
        } catch (err) {
          console.warn(`[SW] Failed to pre-cache ${url}:`, err);
        }
      }
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
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

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || 
      !e.request.url.startsWith(self.location.origin) ||
      e.request.url.includes('/api/')) {
    return;
  }
  
  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      
      return fetch(e.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200) {
          return networkResponse;
        }

        const contentType = networkResponse.headers.get('content-type') || '';
        const url = e.request.url;

        // Safeguard: Don't cache if the network response is HTML but request is for JS/CSS
        if ((url.endsWith('.js') && contentType.includes('text/html')) ||
            (url.endsWith('.css') && contentType.includes('text/html'))) {
          return networkResponse;
        }

        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(e.request, responseToCache);
        });
        return networkResponse;
      }).catch(() => {
        return new Response('Offline: Resource not available');
      });
    })
  );
});
