export const WEB_PUSH_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = `${base64String}${padding}`
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let index = 0; index < rawData.length; index += 1) {
    outputArray[index] = rawData.charCodeAt(index);
  }

  return outputArray;
}

export function isStandaloneMode() {
  if (typeof window === 'undefined') {
    return false;
  }

  const mediaMatch = typeof window.matchMedia === 'function'
    && window.matchMedia('(display-mode: standalone)').matches;

  return Boolean(mediaMatch || window.navigator.standalone === true);
}

export async function getNotificationState() {
  const supported = typeof window !== 'undefined'
    && 'Notification' in window
    && typeof navigator !== 'undefined'
    && 'serviceWorker' in navigator
    && 'PushManager' in window;
  const permission = typeof Notification === 'undefined' ? 'default' : Notification.permission;
  const standalone = isStandaloneMode();

  console.info('[Notifications] Runtime state', {
    supported,
    permission,
    standalone,
  });

  return {
    supported,
    permission,
    standalone,
  };
}

export async function requestNotificationPermission() {
  if (typeof Notification === 'undefined') {
    console.warn('[Notifications] Notification API is not available on this device.');
    return 'denied';
  }

  const permission = await Notification.requestPermission();
  console.info('[Notifications] Permission result', { permission });
  return permission;
}

export async function getWebPushSubscription() {
  if (!WEB_PUSH_PUBLIC_KEY) {
    return {
      ok: false,
      reason: 'missing-vapid-public-key',
    };
  }

  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return {
      ok: false,
      reason: 'unsupported',
    };
  }

  const registration = await navigator.serviceWorker.ready;
  const existingSubscription = await registration.pushManager.getSubscription();
  const subscription = existingSubscription || await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(WEB_PUSH_PUBLIC_KEY),
  });

  return {
    ok: true,
    subscription,
    endpoint: subscription.endpoint,
    keys: subscription.toJSON().keys || {},
  };
}

export async function subscribeToForegroundMessages() {
  return () => {};
}

export function readNotificationPayload(payload) {
  const notification = payload?.notification || {};
  const data = payload?.data || {};

  return {
    title: String(notification.title || data.title || 'Yeni duyuru').trim(),
    body: String(notification.body || data.body || 'Aren Academy panelinde yeni bir bildirim var.').trim(),
    url: String(data.link || data.url || window.location.href).trim(),
    teacherName: String(data.teacherName || data.teacher_name || '').trim(),
  };
}
