// Service worker for the admin page: shows new-order alerts and opens /admin when one is tapped.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const c = all.find(w => new URL(w.url).pathname.startsWith('/admin'));
    if (c) return c.focus();
    return self.clients.openWindow('/admin');
  })());
});
