self.addEventListener('push', (event) => {
  if (!event.data) {
    return;
  }

  let payload;
  try {
    payload = event.data.json();
  } catch (error) {
    payload = {
      title: 'Novo alerta',
      body: event.data.text() || 'Você tem uma nova notificação.',
    };
  }

  const {
    title = 'Novo alerta',
    body = 'Você tem uma nova notificação.',
    icon = '/favicon.ico',
    badge = '/favicon.ico',
    data = {},
    tag,
    actions = []
  } = payload || {};

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      badge,
      data,
      tag,
      actions,
      renotify: true,
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification?.data?.url;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl || '/');
      }
    })
  );
});
