import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { Geolocation } from '@capacitor/geolocation';
import { LocalNotifications } from '@capacitor/local-notifications';
import { PushNotifications } from '@capacitor/push-notifications';

export function isNativeApp() {
  return Capacitor.isNativePlatform();
}

export async function requestNativeLocation() {
  const permission = await Geolocation.requestPermissions();
  const granted = permission.location === 'granted' || permission.coarseLocation === 'granted';
  if (!granted) return { granted: false, permission };
  const position = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 9000 });
  return { granted: true, permission, position };
}

export async function requestNativeNotifications() {
  const localPermission = await LocalNotifications.requestPermissions();
  const pushPermission = await PushNotifications.requestPermissions().catch(() => ({ receive: 'denied' }));
  const granted = localPermission.display === 'granted' || pushPermission.receive === 'granted';
  if (pushPermission.receive === 'granted') {
    PushNotifications.register().catch((error) => {
      console.warn('Native push registration failed.', error);
    });
  }
  return { granted, localPermission, pushPermission };
}

export async function showNativeNotification({ title, body, tag, url }) {
  const permission = await LocalNotifications.checkPermissions();
  if (permission.display !== 'granted') return false;
  await LocalNotifications.schedule({
    notifications: [{
      id: Math.abs(hashNotificationId(tag || `${title}:${body}`)) % 2147483647 || 1,
      title,
      body,
      schedule: { at: new Date(Date.now() + 250) },
      extra: url ? { url } : undefined
    }]
  });
  return true;
}

export async function openExternalUrl(url) {
  if (!url) return;
  const normalizedUrl = normalizeUrl(url);
  if (isNativeApp()) {
    await Browser.open({ url: normalizedUrl, presentationStyle: 'fullscreen' });
    return;
  }
  window.open(normalizedUrl, '_blank', 'noopener,noreferrer');
}

function normalizeUrl(url) {
  if (/^(https?:|mailto:|tel:)/i.test(url)) return url;
  return `https://${url}`;
}

function hashNotificationId(value) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash) + value.charCodeAt(index);
    hash |= 0;
  }
  return hash || Date.now();
}
