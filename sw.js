// OP Chat Service Worker v1.0
const CACHE_NAME = 'opchat-v2';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  'https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;500;600;700&family=Inter:wght@400;500;600;700&display=swap'
];

// ===================== INSTALL =====================
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS).catch(() => {
        // Non-critical — fonts may fail, that's ok
      });
    })
  );
  self.skipWaiting();
});

// ===================== ACTIVATE =====================
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ===================== FETCH — Cache First for static, Network First for API =====================
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // API calls — always network, no cache
  if (url.hostname.includes('api.mxpin.in') || url.hostname.includes('ip-api.com')) {
    e.respondWith(fetch(e.request).catch(() => new Response('{"error":"offline"}', {
      headers: { 'Content-Type': 'application/json' }
    })));
    return;
  }

  // Static assets — Cache First
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res.ok && e.request.method === 'GET') {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        }
        return res;
      }).catch(() => caches.match('/index.html'));
    })
  );
});

// ===================== PUSH NOTIFICATIONS =====================
self.addEventListener('push', e => {
  let data = { title: 'OP Chat', body: 'नया संदेश आया है 💬', icon: '/assets/icons/icon-192.png' };
  try { data = { ...data, ...e.data.json() }; } catch {}

  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon || '/assets/icons/icon-192.png',
      badge: '/assets/icons/icon-192.png',
      vibrate: [200, 100, 200],
      tag: 'opchat-message',
      renotify: true,
      data: { url: data.url || '/' }
    })
  );
});

// ===================== NOTIFICATION CLICK =====================
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      if (list.length > 0) {
        list[0].focus();
        list[0].navigate(e.notification.data?.url || '/');
      } else {
        clients.openWindow(e.notification.data?.url || '/');
      }
    })
  );
});
