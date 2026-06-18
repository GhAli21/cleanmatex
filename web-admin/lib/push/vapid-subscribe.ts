const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const array = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) array[i] = raw.charCodeAt(i);
  return array;
}

/**
 *
 * @param deviceId
 */
export async function subscribeVapid(deviceId: string): Promise<boolean> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('[push] VAPID not supported in this browser');
    return false;
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return false;

  const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  await navigator.serviceWorker.ready;

  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  });

  const json = sub.toJSON() as {
    endpoint: string;
    keys?: { p256dh?: string; auth?: string };
  };

  const res = await fetch('/api/notifications/push-subscription', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      device_id: deviceId,
      provider_code: 'VAPID',
      platform: 'BROWSER',
      subscription_data: {
        endpoint: json.endpoint,
        keys: {
          p256dh: json.keys?.p256dh ?? '',
          auth: json.keys?.auth ?? '',
        },
      },
      app_version: '1.0.0',
    }),
  });

  return res.ok;
}

/**
 *
 * @param deviceId
 */
export async function unsubscribeVapid(deviceId: string): Promise<void> {
  const reg = await navigator.serviceWorker.getRegistration('/sw.js');
  if (reg) {
    const sub = await reg.pushManager.getSubscription();
    if (sub) await sub.unsubscribe();
  }

  await fetch('/api/notifications/push-subscription', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ device_id: deviceId, provider_code: 'VAPID' }),
  });
}
