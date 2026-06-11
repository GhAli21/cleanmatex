# Notification Hub — OneSignal Setup

**Last Updated:** 2026-06-11  
**Purpose:** Set up OneSignal as the PUSH channel provider. OneSignal free tier supports up to 10,000 subscribers with unlimited sends.

**Prerequisites:** OneSignal account (free tier is sufficient).

---

## When to Use OneSignal

| Scenario | Recommendation |
|----------|---------------|
| Budget-conscious setup, < 10,000 subscribers | OneSignal (free) |
| Need a dashboard for push campaign analytics | OneSignal |
| Already using Firebase | FCM |
| Browser-only, no mobile app | VAPID |

---

## Step 1 — Create a OneSignal App

1. Go to [onesignal.com](https://onesignal.com) → Sign up or Log in
2. Dashboard → **New App / Website**
3. Name it: e.g. `CleanMateX Production`
4. Select platforms: **Web Push** (and/or iOS / Android if mobile)

### For Web Push:
5. Choose **Custom Code** (not WordPress/Shopify)
6. **Site URL**: Your app URL (e.g. `https://your-domain.com`)
7. **Default Notification Icon URL**: URL to your 256×256 icon
8. Skip "Advanced Push Settings" for now → **Save**

---

## Step 2 — Get App ID and REST API Key

After creating the app:

1. OneSignal Dashboard → **Settings** → **Keys & IDs**
2. Copy:
   - **OneSignal App ID** (UUID format: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)
   - **REST API Key** (long string)

---

## Step 3 — Set ENV Vars

```env
ONESIGNAL_APP_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
ONESIGNAL_REST_API_KEY=your_rest_api_key_here
```

---

## Step 4 — Activate OneSignal Provider

See [04_provider_activation.md](./04_provider_activation.md) → PUSH → OneSignal section.

---

## Step 5 — Client-Side Integration

OneSignal provides its own SDK for subscribing users. The SDK assigns each user a **player ID** (subscription ID). Your app must capture this player ID and register it with CleanMateX.

### Web (OneSignal Web SDK)

Add to your `app/layout.tsx` or a client component:
```html
<!-- In public/index.html or _document.tsx -->
<script src="https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js" defer></script>
```

```javascript
// After OneSignal SDK initializes:
window.OneSignalDeferred = window.OneSignalDeferred || [];
window.OneSignalDeferred.push(async function(OneSignal) {
  await OneSignal.init({
    appId: process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID,
    notifyButton: { enable: false },
  });

  // Get the player ID after user subscribes
  const playerId = await OneSignal.User.PushSubscription.id;
  if (playerId) {
    await fetch('/api/notifications/push-subscription', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        device_id:         getDeviceId(),    // stable localStorage UUID
        provider_code:     'ONESIGNAL',
        platform:          'BROWSER',
        subscription_data: { player_id: playerId },
        app_version:       '1.0.0',
      }),
    });
  }
});
```

Add to `.env`:
```env
NEXT_PUBLIC_ONESIGNAL_APP_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

### React Native (Expo / OneSignal React Native SDK)

```javascript
import OneSignal from 'react-native-onesignal';

OneSignal.initialize(process.env.EXPO_PUBLIC_ONESIGNAL_APP_ID);
OneSignal.Notifications.requestPermission(true);

// Capture player ID
const deviceState = await OneSignal.User.pushSubscription;
const playerId = deviceState.id;

await fetch('https://your-domain.com/api/notifications/push-subscription', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sessionToken}` },
  body: JSON.stringify({
    device_id:         deviceId,
    provider_code:     'ONESIGNAL',
    platform:          Platform.OS === 'ios' ? 'IOS' : 'ANDROID',
    subscription_data: { player_id: playerId },
  }),
});
```

---

## Verify

```sql
-- Check subscriptions registered
SELECT user_id, device_id, platform, is_active, last_verified_at
FROM org_notif_push_subs_dtl
WHERE provider_code = 'ONESIGNAL' AND is_active = true
ORDER BY last_verified_at DESC;
```

---

## Free Tier Limits

| Limit | Value |
|-------|-------|
| Max subscribers | 10,000 |
| Sends per month | Unlimited |
| Dashboard analytics | Basic |
| API rate limit | 1 req/sec |

When approaching 10,000 subscribers, migrate to FCM (which has no subscriber limit) using the zero-downtime provider switch procedure in [12_provider_switching.md](./12_provider_switching.md).

---

## Deregister on Logout

```javascript
// Unsubscribe from OneSignal
await OneSignal.User.PushSubscription.optOut();

// Then deregister from CleanMateX
await fetch('/api/notifications/push-subscription', {
  method: 'DELETE',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ device_id: deviceId, provider_code: 'ONESIGNAL' }),
});
```
