self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('message', (event) => {
  if (event.data?.type !== 'SHOW_PRAYER_NOTIFICATION') return;
  const { title, body } = event.data;
  event.waitUntil(self.registration.showNotification(title, {
    body,
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: event.data.tag || 'ummah-connect-prayer'
  }));
});
