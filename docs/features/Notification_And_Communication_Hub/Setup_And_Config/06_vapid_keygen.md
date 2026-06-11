# Notification Hub — VAPID Key Generation

**Last Updated:** 2026-06-11  
**Purpose:** Generate VAPID keys for browser Web Push, set the ENV vars, and wire the browser-side subscription call.

**Prerequisites:** `web-push` npm package is already installed in `web-admin` (added in Phase 3).

---

## What Is VAPID?

VAPID (Voluntary Application Server Identification) is the W3C standard for browser push notifications. It uses a P-256 key pair to authenticate push messages to browser vendors (Chrome, Firefox, Safari, Edge). No vendor account needed — just a key pair and a contact URL.

Supported platforms: Chrome (desktop + Android), Firefox, Edge, Safari iOS 16.4+.

---

## Step 1 — Generate the Key Pair

Run once from `web-admin/`:

```bash
cd web-admin
npx web-push generate-vapid-keys
```

Output:
```
=======================================
Public Key:
BK_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

Private Key:
xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
=======================================
```

> **Store these permanently.** Regenerating the keys invalidates all existing browser subscriptions — every user must re-subscribe.

---

## Step 2 — Set ENV Vars

```env
VAPID_PUBLIC_KEY=BK_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
VAPID_PRIVATE_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
VAPID_SUBJECT=mailto:admin@your-domain.com
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BK_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

- `VAPID_SUBJECT`: A `mailto:` or `https:` URI. Browser vendors use this to contact you if there are delivery issues.
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`: Same value as `VAPID_PUBLIC_KEY` — must be public-facing so the browser can create a subscription.

---

## Step 3 — Activate VAPID Provider

See [04_provider_activation.md](./04_provider_activation.md) → PUSH → VAPID section.

Store the public key in the `config` field:
```json
{ "vapid_public_key": "BK_xxxx..." }
```

---

## Step 4 — Browser Service Worker + Subscription

### 4a. Register a service worker

Create `web-admin/public/sw.js`:
```javascript
self.addEventListener('push', function(event) {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'CleanMateX';
  const options = {
    body:  data.body  || '',
    icon:  '/icon-192.png',
    badge: '/badge-72.png',
    data:  data.data  || {},
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const url = event.notification.data?.url || '/dashboard';
  event.waitUntil(clients.openWindow(url));
});
```

### 4b. Subscribe the browser

Call this after the user grants notification permission:

```javascript
// utils/push-subscribe.ts

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw     = atob(base64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

export async function subscribeToPush(deviceId: string): Promise<void> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('Push not supported in this browser');
    return;
  }

  // 1. Request permission
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return;

  // 2. Register service worker
  const reg = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;

  // 3. Subscribe via PushManager
  const subscription = await reg.pushManager.subscribe({
    userVisibleOnly:      true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  });

  const sub = subscription.toJSON();

  // 4. Send subscription to CleanMateX API
  await fetch('/api/notifications/push-subscription', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      device_id:         deviceId,      // stable UUID stored in localStorage
      provider_code:     'VAPID',
      platform:          'BROWSER',
      subscription_data: {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.keys?.p256dh,
          auth:   sub.keys?.auth,
        },
      },
      app_version: '1.0.0',
    }),
  });
}
```

### 4c. Deregister on logout

```javascript
export async function unsubscribeFromPush(deviceId: string): Promise<void> {
  const reg = await navigator.serviceWorker.getRegistration('/sw.js');
  if (reg) {
    const sub = await reg.pushManager.getSubscription();
    if (sub) await sub.unsubscribe();
  }

  await fetch('/api/notifications/push-subscription', {
    method:  'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ device_id: deviceId, provider_code: 'VAPID' }),
  });
}
```

---

## Device ID

Use a stable, client-generated UUID stored in `localStorage`:

```javascript
function getDeviceId(): string {
  const key = 'cmx_device_id';
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
}
```

---

## Verifying the Subscription

```sql
SELECT user_id, device_id, platform, is_active, last_verified_at, failure_count
FROM org_notif_push_subs_dtl
WHERE provider_code = 'VAPID'
  AND is_active = true
ORDER BY last_verified_at DESC
LIMIT 20;
```

---

## Key Rotation

If you must regenerate VAPID keys (e.g. key compromise):
1. Generate new pair with `npx web-push generate-vapid-keys`
2. Update all 4 ENV vars
3. Redeploy the app
4. Run: `UPDATE org_notif_push_subs_dtl SET is_active = false WHERE provider_code = 'VAPID';` (all subscriptions are now invalid)
5. Users will be re-prompted to subscribe on next visit (the browser's existing subscription will fail with 410 Gone, which the adapter handles automatically)
