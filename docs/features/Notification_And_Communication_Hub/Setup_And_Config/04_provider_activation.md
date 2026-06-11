# Notification Hub — Provider Activation

**Last Updated:** 2026-06-11  
**Purpose:** Activate a delivery provider for each notification channel per tenant. Two API calls per provider: register, then activate.

**Prerequisites:**  
- [01_migrations.md](./01_migrations.md) applied  
- [02_supabase_gucs.md](./02_supabase_gucs.md) done  
- [03_env_vars.md](./03_env_vars.md) — relevant ENV vars set  
- Authenticated as tenant admin

---

## How Provider Activation Works

Each tenant stores one row per provider in `org_ntf_channel_provider_cf`. Exactly **one row per channel** can have `is_active = true` (enforced by a partial unique index in the DB).

The two-step flow:
1. **POST** → registers the provider row (inactive by default)
2. **PUT** → atomically sets it as active (sets all others to inactive first)

The `NotificationSettingsService` caches the active provider for 30 seconds. Provider switches take effect within one outbox cycle.

---

## EMAIL → Resend

### Step 1: Register
```bash
POST /api/v1/notifications/settings/providers
Content-Type: application/json
Authorization: Bearer <session-token>

{
  "channel_code": "EMAIL",
  "provider_code": "RESEND",
  "display_name": "Resend (Production)",
  "config": {
    "from_email": "noreply@your-domain.com",
    "from_name": "CleanMateX"
  }
}
```

Response (201):
```json
{ "success": true }
```

### Step 2: Activate
```bash
PUT /api/v1/notifications/settings/providers
Content-Type: application/json
Authorization: Bearer <session-token>

{
  "channel_code": "EMAIL",
  "provider_code": "RESEND"
}
```

### Verify
```sql
SELECT channel_code, provider_code, is_active, config
FROM org_ntf_channel_provider_cf
WHERE channel_code = 'EMAIL';
-- is_active should be true for RESEND
```

---

## SMS → Twilio

> Provider code in DB: `TWILIO_SMS`

### Step 1: Register
```bash
POST /api/v1/notifications/settings/providers
Content-Type: application/json
Authorization: Bearer <session-token>

{
  "channel_code": "SMS",
  "provider_code": "TWILIO_SMS",
  "display_name": "Twilio SMS",
  "config": {
    "from_number": "+14155238886"
  }
}
```

### Step 2: Activate
```bash
PUT /api/v1/notifications/settings/providers
Content-Type: application/json
Authorization: Bearer <session-token>

{
  "channel_code": "SMS",
  "provider_code": "TWILIO_SMS"
}
```

---

## WHATSAPP → Twilio BSP

> Provider code in DB: `TWILIO_WHATSAPP`

### Step 1: Register
```bash
POST /api/v1/notifications/settings/providers
Content-Type: application/json
Authorization: Bearer <session-token>

{
  "channel_code": "WHATSAPP",
  "provider_code": "TWILIO_WHATSAPP",
  "display_name": "WhatsApp via Twilio",
  "config": {
    "from_number": "whatsapp:+14155238886"
  }
}
```

### Step 2: Activate
```bash
PUT /api/v1/notifications/settings/providers
Content-Type: application/json
Authorization: Bearer <session-token>

{
  "channel_code": "WHATSAPP",
  "provider_code": "TWILIO_WHATSAPP"
}
```

> **Note:** WhatsApp via Twilio BSP requires approved templates for business-initiated messages. See [09_whatsapp_templates.md](./09_whatsapp_templates.md).

---

## WHATSAPP → Meta Cloud API

> Provider code in DB: `META_WHATSAPP`

### Step 1: Register
```bash
POST /api/v1/notifications/settings/providers
Content-Type: application/json
Authorization: Bearer <session-token>

{
  "channel_code": "WHATSAPP",
  "provider_code": "META_WHATSAPP",
  "display_name": "WhatsApp via Meta",
  "config": {
    "phone_number_id": "123456789012345",
    "business_account_id": "your_waba_id"
  }
}
```

### Step 2: Activate
```bash
PUT /api/v1/notifications/settings/providers
Content-Type: application/json
Authorization: Bearer <session-token>

{
  "channel_code": "WHATSAPP",
  "provider_code": "META_WHATSAPP"
}
```

---

## PUSH → VAPID (browser Web Push)

> Provider code in DB: `VAPID`  
> Requires: VAPID key pair generated (see [06_vapid_keygen.md](./06_vapid_keygen.md))

### Step 1: Register
```bash
POST /api/v1/notifications/settings/providers
Content-Type: application/json
Authorization: Bearer <session-token>

{
  "channel_code": "PUSH",
  "provider_code": "VAPID",
  "display_name": "Browser Web Push (VAPID)",
  "config": {
    "vapid_public_key": "BKxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
  }
}
```

> Store the public key in `config` so the browser can retrieve it via the providers API if needed.

### Step 2: Activate
```bash
PUT /api/v1/notifications/settings/providers
Content-Type: application/json
Authorization: Bearer <session-token>

{
  "channel_code": "PUSH",
  "provider_code": "VAPID"
}
```

---

## PUSH → FCM

> Provider code in DB: `FCM`  
> Requires: [07_fcm_setup.md](./07_fcm_setup.md) complete

### Step 1: Register
```bash
POST /api/v1/notifications/settings/providers
Content-Type: application/json
Authorization: Bearer <session-token>

{
  "channel_code": "PUSH",
  "provider_code": "FCM",
  "display_name": "Firebase Cloud Messaging",
  "config": {
    "project_id": "your-firebase-project-id"
  }
}
```

### Step 2: Activate
```bash
PUT /api/v1/notifications/settings/providers
Content-Type: application/json
Authorization: Bearer <session-token>

{
  "channel_code": "PUSH",
  "provider_code": "FCM"
}
```

---

## PUSH → OneSignal

> Provider code in DB: `ONESIGNAL`  
> Requires: [08_onesignal_setup.md](./08_onesignal_setup.md) complete

### Step 1: Register
```bash
POST /api/v1/notifications/settings/providers
Content-Type: application/json
Authorization: Bearer <session-token>

{
  "channel_code": "PUSH",
  "provider_code": "ONESIGNAL",
  "display_name": "OneSignal",
  "config": {
    "app_id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
  }
}
```

### Step 2: Activate
```bash
PUT /api/v1/notifications/settings/providers
Content-Type: application/json
Authorization: Bearer <session-token>

{
  "channel_code": "PUSH",
  "provider_code": "ONESIGNAL"
}
```

---

## List All Active Providers (GET)

```bash
GET /api/v1/notifications/settings/providers
Authorization: Bearer <session-token>

# Filter by channel:
GET /api/v1/notifications/settings/providers?channel_code=PUSH
```

---

## Remove a Provider

> Cannot remove an active provider. Deactivate first by activating another, or disable the channel.

```bash
DELETE /api/v1/notifications/settings/providers?channel_code=PUSH&provider_code=FCM
Authorization: Bearer <session-token>
```

Returns 409 if the provider is currently active.

---

## Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| 409 Conflict on POST | Provider already registered | Already exists — skip POST, use PUT to activate |
| 404 on PUT | Provider not registered | Run POST first, then PUT |
| 409 on DELETE | Trying to delete active provider | Activate a different provider first |
| Provider still TWILIO (old) | Code says TWILIO not TWILIO_SMS | The correct DB code is `TWILIO_SMS` — use that in all API calls |
