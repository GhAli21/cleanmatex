# Notification Hub — Environment Variables Reference

**Last Updated:** 2026-06-11  
**Purpose:** Complete reference for every environment variable used by the Notification Hub. Set these in `.env.local` (development) or your deployment secrets manager (production).

**Prerequisites:** [01_migrations.md](./01_migrations.md) applied, [02_supabase_gucs.md](./02_supabase_gucs.md) completed.

---

## Core (Required for All Channels)

| Variable | Required | Format | Where to get it |
|----------|----------|--------|-----------------|
| `NOTIFICATIONS_OUTBOX_SECRET` | ✅ Yes | Random hex string ≥ 32 chars | Generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `RESEND_API_KEY` | ✅ Yes (for EMAIL) | `re_xxxxxxxxxxxxxxxx` | resend.com → API Keys |

```env
NOTIFICATIONS_OUTBOX_SECRET=a3f8c2d1b4e7f0a9c6d3b2e1f4a7c0d9b6e3f0a9c6d3b2e1f4a7c0d9b6e3f0a9
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx
```

> `NOTIFICATIONS_OUTBOX_SECRET` must exactly match the `app.outbox_secret_key` GUC set in Supabase (see [02_supabase_gucs.md](./02_supabase_gucs.md)).

---

## SMS — Twilio (provider code: `TWILIO_SMS`)

| Variable | Required | Format | Where to get it |
|----------|----------|--------|-----------------|
| `TWILIO_ACCOUNT_SID` | ✅ | `ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` | console.twilio.com → Account Info |
| `TWILIO_AUTH_TOKEN` | ✅ | 32-char hex | console.twilio.com → Account Info |
| `TWILIO_SMS_FROM` | ✅ | E.164 phone number | Twilio Console → Phone Numbers |

```env
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_SMS_FROM=+14155238886
```

---

## WhatsApp — Twilio BSP (provider code: `TWILIO_WHATSAPP`)

Shares `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN` with SMS. Only needs one additional var:

| Variable | Required | Format | Where to get it |
|----------|----------|--------|-----------------|
| `TWILIO_WHATSAPP_FROM` | ✅ | E.164 phone number | Twilio Console → Messaging → WhatsApp |

```env
# Reuses TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN from SMS section above
TWILIO_WHATSAPP_FROM=+14155238886
```

> The adapter prepends `whatsapp:` automatically if not already present.

---

## WhatsApp — Meta Cloud API (provider code: `META_WHATSAPP`)

| Variable | Required | Format | Where to get it |
|----------|----------|--------|-----------------|
| `META_WHATSAPP_ACCESS_TOKEN` | ✅ | `EAAxxxxxxxxx...` | Meta Business Suite → App Dashboard → WhatsApp → API Setup |
| `META_WHATSAPP_PHONE_NUMBER_ID` | ✅ | Numeric string | Meta Business Suite → WhatsApp → Phone Numbers |

```env
META_WHATSAPP_ACCESS_TOKEN=EAAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
META_WHATSAPP_PHONE_NUMBER_ID=123456789012345
```

> Meta access tokens expire. For production, generate a system user token (non-expiring) from Meta Business Suite → Business Settings → System Users.

---

## Push — VAPID (provider code: `VAPID`)

| Variable | Required | Format | Where to get it |
|----------|----------|--------|-----------------|
| `VAPID_PUBLIC_KEY` | ✅ | Base64url P-256 public key (~88 chars starting with `B`) | Generate once — see [06_vapid_keygen.md](./06_vapid_keygen.md) |
| `VAPID_PRIVATE_KEY` | ✅ | Base64url P-256 private key (~44 chars) | Same generation step |
| `VAPID_SUBJECT` | ✅ | `mailto:admin@domain.com` or `https://domain.com` | Your contact info |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | ✅ | Same value as `VAPID_PUBLIC_KEY` | Same key — must be public-facing for browser |

```env
VAPID_PUBLIC_KEY=BKxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
VAPID_PRIVATE_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
VAPID_SUBJECT=mailto:admin@cleanmatex.com
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BKxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

> Generate key pair with: `cd web-admin && npx web-push generate-vapid-keys`  
> See [06_vapid_keygen.md](./06_vapid_keygen.md) for the full browser integration.

---

## Push — FCM (provider code: `FCM`)

| Variable | Required | Format | Where to get it |
|----------|----------|--------|-----------------|
| `FCM_SERVICE_ACCOUNT_JSON` | ✅ | Base64-encoded JSON string **or** raw JSON string | Firebase Console → Project Settings → Service Accounts → Generate key |
| `FCM_PROJECT_ID` | ✅ | String (e.g. `my-firebase-project`) | Firebase Console → Project Settings → General |

```env
FCM_SERVICE_ACCOUNT_JSON=eyJ0eXBlIjoic2VydmljZV9hY2NvdW50IiwicHJvamVjdF9pZCI6InlvdXItcHJvamVjdCIsInByaXZhdGVfa2V5X2lkIjoiLi4uIn0=
FCM_PROJECT_ID=your-firebase-project-id
```

> See [07_fcm_setup.md](./07_fcm_setup.md) for how to generate and encode the service account JSON.

---

## Push — OneSignal (provider code: `ONESIGNAL`)

| Variable | Required | Format | Where to get it |
|----------|----------|--------|-----------------|
| `ONESIGNAL_APP_ID` | ✅ | UUID (`xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`) | OneSignal Dashboard → Settings → Keys & IDs |
| `ONESIGNAL_REST_API_KEY` | ✅ | String | OneSignal Dashboard → Settings → Keys & IDs |

```env
ONESIGNAL_APP_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
ONESIGNAL_REST_API_KEY=your_rest_api_key_here
```

> See [08_onesignal_setup.md](./08_onesignal_setup.md) for account setup steps.

---

## Complete `.env.local` Template

Copy and fill in the values you need:

```env
# ── Core ──────────────────────────────────────────────────────────────────
NOTIFICATIONS_OUTBOX_SECRET=REPLACE_WITH_GENERATED_SECRET
RESEND_API_KEY=re_REPLACE_WITH_RESEND_KEY

# ── SMS (Twilio) ──────────────────────────────────────────────────────────
TWILIO_ACCOUNT_SID=ACREPLACE
TWILIO_AUTH_TOKEN=REPLACE
TWILIO_SMS_FROM=+REPLACE

# ── WhatsApp Twilio BSP ───────────────────────────────────────────────────
# Reuses TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN above
TWILIO_WHATSAPP_FROM=+REPLACE

# ── WhatsApp Meta Cloud API ───────────────────────────────────────────────
META_WHATSAPP_ACCESS_TOKEN=EAA_REPLACE
META_WHATSAPP_PHONE_NUMBER_ID=REPLACE_NUMERIC

# ── Push: VAPID ───────────────────────────────────────────────────────────
VAPID_PUBLIC_KEY=REPLACE_B64URL
VAPID_PRIVATE_KEY=REPLACE_B64URL
VAPID_SUBJECT=mailto:admin@your-domain.com
NEXT_PUBLIC_VAPID_PUBLIC_KEY=REPLACE_SAME_AS_VAPID_PUBLIC_KEY

# ── Push: FCM ─────────────────────────────────────────────────────────────
FCM_SERVICE_ACCOUNT_JSON=REPLACE_BASE64_OR_RAW_JSON
FCM_PROJECT_ID=REPLACE_PROJECT_ID

# ── Push: OneSignal ───────────────────────────────────────────────────────
ONESIGNAL_APP_ID=REPLACE_UUID
ONESIGNAL_REST_API_KEY=REPLACE_KEY
```

---

## Minimal Setup (EMAIL + IN_APP only)

```env
NOTIFICATIONS_OUTBOX_SECRET=your-secret-here
RESEND_API_KEY=re_your_key_here
```

This is sufficient to run in-app notifications and email delivery. All other channels will be dispatched as `SKIPPED` until their provider is configured and activated.
