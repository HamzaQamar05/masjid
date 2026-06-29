const CACHE_NAME = 'mujtama-shell-v1';
const STATIC_ASSETS = [
  '/',
  '/app',
  '/manifest.webmanifest',
  '/icons/mujtama-icon-192.png',
  '/icons/mujtama-icon-512.png',
  '/og/mujtama-og-1200x630.png',
  '/splash/apple-splash-640x1136.png',
  '/splash/apple-splash-750x1334.png',
  '/splash/apple-splash-828x1792.png',
  '/splash/apple-splash-1125x2436.png',
  '/splash/apple-splash-1170x2532.png',
  '/splash/apple-splash-1179x2556.png',
  '/splash/apple-splash-1242x2208.png',
  '/splash/apple-splash-1242x2688.png',
  '/splash/apple-splash-1284x2778.png',
  '/splash/apple-splash-1290x2796.png',
  '/splash/apple-splash-1536x2048.png',
  '/splash/apple-splash-1668x2224.png',
  '/splash/apple-splash-1668x2388.png',
  '/splash/apple-splash-2048x2732.png'
];
const RUNTIME_CACHE = 'mujtama-runtime-v1';

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => ![CACHE_NAME, RUNTIME_CACHE].includes(key)).map((key) => caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('/app').then((match) => match || caches.match('/'))));
    return;
  }

  if (url.origin === self.location.origin && (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/'))) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request).then((response) => {
        const copy = response.clone();
        caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy));
        return response;
      }))
    );
  }
});

self.addEventListener('message', (event) => {
  if (!['SHOW_PRAYER_NOTIFICATION', 'SHOW_APP_NOTIFICATION'].includes(event.data?.type)) return;
  const { title, body, url } = event.data;
  event.waitUntil(self.registration.showNotification(title, {
    body,
    icon: '/icons/mujtama-icon-192.png',
    badge: '/icons/mujtama-icon-192.png',
    tag: event.data.tag || 'mujtama',
    data: { url: url || '/app' }
  }));
});

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: 'Mujtama', body: event.data?.text?.() || '' };
  }
  event.waitUntil(self.registration.showNotification(payload.title || 'Mujtama', {
    body: payload.body || '',
    icon: '/icons/mujtama-icon-192.png',
    badge: '/icons/mujtama-icon-192.png',
    tag: payload.tag || payload.messageId || payload.type || 'mujtama',
    data: { url: payload.url || '/app' }
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/app';
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
    const existing = clients.find((client) => 'focus' in client);
    if (existing) {
      existing.navigate(url);
      return existing.focus();
    }
    return self.clients.openWindow(url);
  }));
});
