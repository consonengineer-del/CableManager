const CACHE_NAME = 'cable-manager-v4-offline';
const DYNAMIC_CACHE = 'cable-dynamic-v4';

// Files to cache immediately on install
// We reduce this list to the absolute essentials. 
// Component files and other modules will be cached at runtime when they are requested.
// This prevents the entire install from failing if one sub-component path is incorrect.
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/index.tsx',
  '/App.tsx',
  '/types.ts',
  '/config.ts',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  self.skipWaiting(); // Activate worker immediately
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache v4');
        return cache.addAll(PRECACHE_URLS);
      })
      .catch(err => {
        console.error('Precache failed:', err);
      })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== DYNAMIC_CACHE) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. Google APIs: Network Only (Never cache auth/drive requests)
  if (url.hostname.includes('google') || url.hostname.includes('googleapis')) {
    return; // Let browser handle network request normally
  }

  // 2. Browser Sync / Hot Reload (Ignore)
  if (url.pathname.includes('hot-update')) {
    return;
  }

  // 3. Cache First Strategy
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      // If not in cache, fetch from network and cache it (Runtime Caching)
      return fetch(event.request).then((networkResponse) => {
        // Check if we received a valid response
        if (!networkResponse || networkResponse.status !== 200 || (networkResponse.type !== 'basic' && networkResponse.type !== 'cors')) {
          return networkResponse;
        }

        const responseToCache = networkResponse.clone();

        caches.open(DYNAMIC_CACHE).then((cache) => {
            // Cache requests to CDNs (React, Tailwind, etc) and local files
            if (url.protocol === 'http:' || url.protocol === 'https:') {
                 cache.put(event.request, responseToCache);
            }
        });

        return networkResponse;
      }).catch(() => {
        // Fallback for navigation requests (e.g. if offline and reloading page)
        if (event.request.mode === 'navigate') {
          return caches.match('/index.html');
        }
      });
    })
  );
});