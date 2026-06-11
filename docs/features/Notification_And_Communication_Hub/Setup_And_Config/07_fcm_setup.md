# Notification Hub — FCM Setup

**Last Updated:** 2026-06-11  
**Purpose:** Set up Firebase Cloud Messaging (FCM) for mobile push notifications (iOS, Android) and/or web push via the FCM v1 HTTP API.

**Prerequisites:** Google account with access to Firebase Console.

> The FCM adapter uses the FCM v1 REST API with a service account JWT — no Firebase SDK is imported. This avoids the large `firebase-admin` dependency.

---

## When to Use FCM vs VAPID

| Use case | Recommended provider |
|----------|---------------------|
| Browser push (Chrome, Firefox, Edge, Safari) | VAPID |
| Android app push | FCM |
| iOS app push | FCM (via APNs gateway in FCM) |
| Both browser + mobile from one provider | FCM |

You can run both VAPID and FCM simultaneously — subscriptions in `org_notif_push_subs_dtl` are per `provider_code`, so a user can have both a VAPID browser subscription and an FCM mobile subscription. Only one provider can be **active** per channel at a time, so choose based on your primary use case.

---

## Step 1 — Create Firebase Project

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Click **Add project**
3. Name it (e.g. `cleanmatex-production`)
4. Disable Google Analytics if not needed → **Create project**

---

## Step 2 — Generate Service Account Key

1. In Firebase Console → **Project Settings** (gear icon) → **Service Accounts** tab
2. Click **Generate new private key**
3. Confirm → download the JSON file (e.g. `cleanmatex-production-firebase-adminsdk-xxxxx.json`)

The JSON looks like:
```json
{
  "type": "service_account",
  "project_id": "cleanmatex-production",
  "private_key_id": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "private_key": "-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-xxxxx@cleanmatex-production.iam.gserviceaccount.com",
  "token_uri": "https://oauth2.googleapis.com/token"
}
```

---

## Step 3 — Encode and Set ENV Vars

### Option A — Base64 encoded (recommended for deployment secrets)

```bash
# Linux/Mac
base64 -w 0 cleanmatex-production-firebase-adminsdk-xxxxx.json

# Windows PowerShell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("cleanmatex-production-firebase-adminsdk-xxxxx.json"))
```

Copy the output and set:
```env
FCM_SERVICE_ACCOUNT_JSON=eyJ0eXBlIjoic2VydmljZV9hY2NvdW50IiwicHJvamVjdF9pZCI6ImNsZWFubWF0ZXgtcHJvZHVjdGlvbiIsInByaXZhdGVfa2V5X2lkIjoieHh4eHh4In0=
FCM_PROJECT_ID=cleanmatex-production
```

### Option B — Raw JSON (for local dev only)

```env
FCM_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"cleanmatex-production",...}
FCM_PROJECT_ID=cleanmatex-production
```

> The adapter detects the format automatically: if the value starts with `{` it parses as JSON, otherwise decodes from base64.

---

## Step 4 — Enable FCM API in Google Cloud

1. Go to [console.cloud.google.com](https://console.cloud.google.com) → select your Firebase project
2. APIs & Services → **Enable APIs and Services**
3. Search for "Firebase Cloud Messaging API" → Enable it

---

## Step 5 — Activate FCM Provider

See [04_provider_activation.md](./04_provider_activation.md) → PUSH → FCM section.

---

## Step 6 — Mobile/Web Client Setup

The FCM registration token (`data.token`) comes from the mobile SDK or web SDK:

**Android (Firebase SDK)**:
```kotlin
FirebaseMessaging.getInstance().token.addOnCompleteListener { task ->
    val token = task.result
    // POST to /api/notifications/push-subscription
    // provider_code: "FCM", platform: "ANDROID"
    // subscription_data: { "token": token }
}
```

**iOS (Firebase SDK)**:
```swift
Messaging.messaging().token { token, error in
    // POST to /api/notifications/push-subscription
    // provider_code: "FCM", platform: "IOS"
    // subscription_data: { "token": token }
}
```

**Web (Firebase Web SDK)**:
```javascript
import { getMessaging, getToken } from 'firebase/messaging';
const messaging = getMessaging();
const token = await getToken(messaging, { vapidKey: 'YOUR_FCM_WEB_PUSH_CERT_KEY' });
// POST to /api/notifications/push-subscription
// provider_code: "FCM", platform: "WEB"
// subscription_data: { "token": token }
```

---

## Verify FCM Access Token Generation

The adapter generates a JWT and exchanges it for an OAuth2 access token. You can test this manually:

```javascript
// Test in Node.js
const { createSign } = require('crypto');
const sa = require('./service-account.json');
const now = Math.floor(Date.now() / 1000);
const payload = { iss: sa.client_email, scope: 'https://www.googleapis.com/auth/firebase.messaging', aud: sa.token_uri, iat: now, exp: now + 3600 };
console.log('client_email:', sa.client_email);
console.log('token_uri:', sa.token_uri);
// If these are populated, the service account JSON is valid.
```

---

## Token Expiry

FCM device tokens expire when:
- User uninstalls the app
- User clears app data
- Token not refreshed for 270 days (Firebase policy)

The adapter handles `NOT_FOUND` / `UNREGISTERED` errors by setting `is_active = false` on the subscription row. The weekly cron sweep also cleans up subscriptions with `failure_count > 3`.

Mobile clients should call `POST /api/notifications/push-subscription` on every app launch (the endpoint is idempotent — it upserts and resets `failure_count`).
