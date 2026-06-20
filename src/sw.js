import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';
import { clientsClaim } from 'workbox-core';
import { registerRoute } from 'workbox-routing';
import { CacheFirst } from 'workbox-strategies';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { ExpirationPlugin } from 'workbox-expiration';

self.skipWaiting();
clientsClaim();
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({
    cacheName: 'mujtama-feed-images-v1',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 160, maxAgeSeconds: 60 * 60 * 24 * 30, purgeOnQuotaError: true })
    ]
  })
);

self.addEventListener('message', (event) => {
  if (!['SHOW_PRAYER_NOTIFICATION', 'SHOW_APP_NOTIFICATION'].includes(event.data?.type)) return;
  const { title, body, url } = event.data;
  event.waitUntil(self.registration.showNotification(title, {
    body,
    icon: '/icons/mujtama-icon-192.png',
    badge: '/icons/mujtama-icon-192.png',
    tag: event.data.tag || 'mujtama',
    data: { url: url || '/' }
  }));
});

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: 'Mujtama', body: event.data?.text?.() || '' };
  }
  const title = payload.title || 'Mujtama';
  event.waitUntil(self.registration.showNotification(title, {
    body: payload.body || '',
    icon: '/icons/mujtama-icon-192.png',
    badge: '/icons/mujtama-icon-192.png',
    tag: payload.tag || payload.messageId || payload.type || 'mujtama',
    data: {
      url: payload.url || '/'
    }
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
    const existing = clients.find((client) => 'focus' in client);
    if (existing) {
      existing.navigate(url);
      return existing.focus();
    }
    return self.clients.openWindow(url);
  }));
});
