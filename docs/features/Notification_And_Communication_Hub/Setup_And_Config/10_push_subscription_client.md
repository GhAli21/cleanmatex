# Notification Hub — Push Subscription Client Integration

**Last Updated:** 2026-06-11  
**Purpose:** Complete client-side code for requesting browser push permission, subscribing, and deregistering. Covers VAPID, FCM, and OneSignal flows.

**Prerequisites:**  
- Provider activated: [04_provider_activation.md](./04_provider_activation.md)  
- For VAPID: [06_vapid_keygen.md](./06_vapid_keygen.md)  
- For FCM web: [07_fcm_setup.md](./07_fcm_setup.md)  
- For OneSignal: [08_onesignal_setup.md](./08_onesignal_setup.md)

---

## API Endpoints

```
POST   /api/notifications/push-subscription   — register or refresh subscription
DELETE /api/notifications/push-subscription   — deregister on logout
```

Auth: session cookie (same as all web-admin routes). `requirePermission('notifications:read')` guard.

---

## Shared Utility — Stable Device ID

All providers need a stable `device_id` to identify the browser/device across sessions:

```typescript
// lib/push/device-id.ts
export function getDeviceId(): string {
  const KEY = 'cmx_push_device_id';
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
  }
  return id;
}
```

---

## VAPID — Browser Web Push

### Service Worker (`public/sw.js`)

```javascript
// Handles incoming push messages and shows browser notification
self.addEventListener('push', function(event) {
  if (!event.data) return;

  const data = event.data.json();
  const title   = data.title || 'CleanMateX';
  const options = {
    body:    data.body || '',
    icon:    '/icons/icon-192.png',
    badge:   '/icons/badge-72.png',
    tag:     data.data?.outbox_id || 'cmx-notification',
    renotify: true,
    data:    data.data || {},
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const url = event.notification.data?.url || '/dashboard/notifications';
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(function(clientList) {
      for (const client of clientList) {
        if (client.url === url && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
```

### Subscription Helper (`lib/push/vapid-subscribe.ts`)

```typescript
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw     = window.atob(base64);
  const array   = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) array[i] = raw.charCodeAt(i);
  return array;
}

export async function subscribeVapid(deviceId: string): Promise<boolean> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('[push] Not supported in this browser');
    return false;
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return false;

  const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  await navigator.serviceWorker.ready;

  const sub = await reg.pushManager.subscribe({
    userVisibleOnly:      true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  });

  const json = sub.toJSON() as {
    endpoint: string;
    keys?: { p256dh?: string; auth?: string };
  };

  const res = await fetch('/api/notifications/push-subscription', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      device_id:         deviceId,
      provider_code:     'VAPID',
      platform:          'BROWSER',
      subscription_data: {
        endpoint: json.endpoint,
        keys: {
          p256dh: json.keys?.p256dh ?? '',
          auth:   json.keys?.auth   ?? '',
        },
      },
      app_version: '1.0.0',
    }),
  });

  return res.ok;
}

export async function unsubscribeVapid(deviceId: string): Promise<void> {
  const reg = await navigator.serviceWorker.getRegistration('/sw.js');
  if (reg) {
    const sub = await reg.pushManager.getSubscription();
    if (sub) await sub.unsubscribe();
  }

  await fetch('/api/notifications/push-subscription', {
    method:  'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ device_id: deviceId, provider_code: 'VAPID' }),
  });
}
```

### React Hook (`lib/push/use-push-vapid.ts`)

```typescript
'use client';
import { useState, useEffect } from 'react';
import { getDeviceId } from './device-id';
import { subscribeVapid, unsubscribeVapid } from './vapid-subscribe';

export function useVapidPush() {
  const [subscribed, setSubscribed] = useState(false);
  const [loading,    setLoading   ] = useState(false);

  useEffect(() => {
    navigator.serviceWorker.getRegistration('/sw.js').then(async (reg) => {
      if (reg) {
        const sub = await reg.pushManager.getSubscription();
        setSubscribed(!!sub);
      }
    });
  }, []);

  async function subscribe() {
    setLoading(true);
    const ok = await subscribeVapid(getDeviceId());
    setSubscribed(ok);
    setLoading(false);
  }

  async function unsubscribe() {
    setLoading(true);
    await unsubscribeVapid(getDeviceId());
    setSubscribed(false);
    setLoading(false);
  }

  return { subscribed, loading, subscribe, unsubscribe };
}
```

---

## FCM — Mobile Clients

### Android (Kotlin)

```kotlin
// In your main Activity or Application class
FirebaseMessaging.getInstance().token.addOnCompleteListener { task ->
    if (!task.isSuccessful) return@addOnCompleteListener
    val token = task.result

    val deviceId = getOrCreateDeviceId()  // stored in SharedPreferences

    // Register with CleanMateX
    val client = OkHttpClient()
    val body = JSONObject().apply {
        put("device_id", deviceId)
        put("provider_code", "FCM")
        put("platform", "ANDROID")
        put("subscription_data", JSONObject().apply { put("token", token) })
        put("app_version", BuildConfig.VERSION_NAME)
    }.toString()

    val request = Request.Builder()
        .url("$BASE_URL/api/notifications/push-subscription")
        .post(body.toRequestBody("application/json".toMediaType()))
        .addHeader("Authorization", "Bearer $sessionToken")
        .build()

    client.newCall(request).execute()
}
```

### iOS (Swift)

```swift
// In AppDelegate or notification registration code
Messaging.messaging().token { token, error in
    guard let token = token else { return }
    let deviceId = getOrCreateDeviceId()

    var request = URLRequest(url: URL(string: "\(baseURL)/api/notifications/push-subscription")!)
    request.httpMethod = "POST"
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    request.setValue("Bearer \(sessionToken)", forHTTPHeaderField: "Authorization")
    request.httpBody = try? JSONSerialization.data(withJSONObject: [
        "device_id": deviceId,
        "provider_code": "FCM",
        "platform": "IOS",
        "subscription_data": ["token": token],
        "app_version": Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0"
    ])
    URLSession.shared.dataTask(with: request).resume()
}
```

---

## OneSignal — Web

```typescript
// lib/push/onesignal-subscribe.ts
declare global {
  interface Window { OneSignalDeferred?: ((os: unknown) => void)[] }
}

export async function initOneSignal(deviceId: string): Promise<void> {
  window.OneSignalDeferred = window.OneSignalDeferred || [];
  window.OneSignalDeferred.push(async (OneSignal: {
    init: (opts: { appId: string; notifyButton: { enable: boolean } }) => Promise<void>
    User: { PushSubscription: { id: Promise<string | null> } }
    Notifications: { requestPermission: () => Promise<void> }
  }) => {
    await OneSignal.init({
      appId:         process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID!,
      notifyButton:  { enable: false },
    });

    await OneSignal.Notifications.requestPermission();
    const playerId = await OneSignal.User.PushSubscription.id;
    if (!playerId) return;

    await fetch('/api/notifications/push-subscription', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        device_id:         deviceId,
        provider_code:     'ONESIGNAL',
        platform:          'BROWSER',
        subscription_data: { player_id: playerId },
        app_version:       '1.0.0',
      }),
    });
  });
}
```

---

## Deregister Pattern (all providers)

Call on logout, regardless of provider:

```typescript
// lib/push/deregister.ts
export async function deregisterPush(deviceId: string, providerCode: 'VAPID' | 'FCM' | 'ONESIGNAL'): Promise<void> {
  await fetch('/api/notifications/push-subscription', {
    method:  'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ device_id: deviceId, provider_code: providerCode }),
  });
}
```

---

## Push Subscription Refresh

On every app launch, re-call the subscribe function. The API upserts (idempotent) and resets `failure_count` and `last_verified_at`, which prevents the stale-subscription sweep from deactivating valid subscriptions.
