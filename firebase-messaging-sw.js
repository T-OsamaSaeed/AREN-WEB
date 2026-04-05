importScripts('https://www.gstatic.com/firebasejs/12.11.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.11.0/firebase-messaging-compat.js');

// Background worker used by Firebase Cloud Messaging for web push notifications.
firebase.initializeApp({
  apiKey: 'AIzaSyBPJPH_oII3pNHdmLOZ667vaBP0yGfK25g',
  authDomain: 'academy-notifications-27221.firebaseapp.com',
  projectId: 'academy-notifications-27221',
  storageBucket: 'academy-notifications-27221.firebasestorage.app',
  messagingSenderId: '693565676714',
  appId: '1:693565676714:web:5a49e6dfda9847138c04d3',
  measurementId: 'G-07LGEVGQL1',
});

const messaging = firebase.messaging();
const APP_HOME_URL = new URL('./', self.location.href).toString();
const APP_ICON_URL = new URL('./pwa-192.png?v=aren-brand-9', self.location.href).toString();

function readBackgroundPayload(payload) {
  const notification = payload?.notification || {};
  const data = payload?.data || {};

  return {
    title: String(notification.title || data.title || 'Yeni duyuru').trim(),
    body: String(notification.body || data.body || 'Aren Academy panelinde yeni bir bildirim var.').trim(),
    url: String(payload?.fcmOptions?.link || data.link || data.url || APP_HOME_URL).trim(),
  };
}

messaging.onBackgroundMessage((payload) => {
  const pushMessage = readBackgroundPayload(payload);

  // Show a system notification even if the website is closed.
  self.registration.showNotification(pushMessage.title, {
    body: pushMessage.body,
    icon: APP_ICON_URL,
    badge: APP_ICON_URL,
    data: {
      url: pushMessage.url,
    },
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || APP_HOME_URL;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      const matchingClient = clientList.find((client) => client.url === targetUrl || client.url.startsWith(targetUrl));

      if (matchingClient) {
        return matchingClient.focus();
      }

      return self.clients.openWindow(targetUrl);
    }),
  );
});
