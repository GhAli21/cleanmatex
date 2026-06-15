# CMX-PRD-019 — Notification & Communication Hub
# Setup Guide

**Version:** Phase 3 (Phases 1–3 complete)  
**Last Updated:** 2026-06-11  
**Status file:** [STATUS.md](./STATUS.md)

---

## Overview

This guide walks through the full setup of the Notification & Communication Hub from a fresh deployment. It covers database migrations, Supabase configuration, environment variables, and provider activation for each channel.

**Channels supported:**
| Channel | Provider options |
|---------|-----------------|
| IN_APP | Built-in (Supabase Realtime) |
| EMAIL | Resend |
| SMS | Twilio |
| WHATSAPP | Twilio BSP or Meta Cloud API |
| PUSH | VAPID (browser), FCM (mobile/web), OneSignal |

---

## Step 1 — Apply Database Migrations

Run migrations in order. **Never skip, never re-apply an already-applied migration.**

```bash
# In supabase/migrations/ — apply via Supabase dashboard or CLI
0344_notif_catalog_schema.sql
0345_notif_catalog_seed.sql
0346_notif_templates_schema.sql
0347_notif_tenant_settings.sql
0348_ntf_runtime_tables.sql
0349_ntf_permissions_and_nav.sql
0350_ntf_outbox_cron.sql
0351_notif_push_subscriptions.sql
0352_notif_channel_provider_cf.sql
0353_notif_push_sweep_cron.sql
```

Verify with:
```sql
SELECT code FROM sys_ntf_channel_cd ORDER BY code;
-- Expected: EMAIL, IN_APP, PUSH, SMS, WEB_SOCKET, WHATSAPP

SELECT code FROM sys_ntf_providers_cd ORDER BY display_order;
-- Expected: SENDGRID, TWILIO, TWILIO_WHATSAPP, INTERNAL, FCM, RESEND, VAPID, ONESIGNAL, META_WHATSAPP + any others
```

---

## Step 2 — Supabase GUCs

These must be set once in the Supabase SQL editor (not in migration files):

```sql
-- Replace with your actual values
ALTER DATABASE postgres SET app.next_js_base_url = 'https://your-app-domain.com';
ALTER DATABASE postgres SET app.outbox_secret_key = 'your-strong-random-secret-32chars+';
```

The `outbox_secret_key` value must exactly match the `NOTIFICATIONS_OUTBOX_SECRET` env var you set in Step 3.

To generate a strong secret:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Step 3 — Environment Variables

Add these to your `.env.local` (development) or deployment secrets (production).

### Required (all environments)

```env
# Outbox processor authorization — must match app.outbox_secret_key GUC above
NOTIFICATIONS_OUTBOX_SECRET=your-strong-random-secret-32chars+

# Email — Resend (already used by other features)
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx
```

### SMS — Twilio (activate SMS channel)

```env
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_SMS_FROM=+14155238886          # Your Twilio phone number (E.164 format)
```

### WhatsApp via Twilio BSP

```env
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx   # same as SMS
TWILIO_AUTH_TOKEN=your_auth_token_here                  # same as SMS
TWILIO_WHATSAPP_FROM=+14155238886                       # Your WhatsApp-enabled Twilio number
```

### WhatsApp via Meta Cloud API (direct)

```env
META_WHATSAPP_ACCESS_TOKEN=EAAxxxxxxxxxxxxxxxxxxxxxxxxx   # Meta Business App access token
META_WHATSAPP_PHONE_NUMBER_ID=123456789012345             # From Meta Business Manager
```

### Push — VAPID (browser Web Push, free, no vendor)

Generate your VAPID key pair once and store permanently:
```bash
cd web-admin
npx web-push generate-vapid-keys
```

Output:
```
Public Key:  BKxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
Private Key: xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

```env
VAPID_PUBLIC_KEY=BKxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
VAPID_PRIVATE_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
VAPID_SUBJECT=mailto:admin@your-domain.com    # or https://your-domain.com
```

> The `VAPID_PUBLIC_KEY` must also be served to the browser for the subscription call.  
> Expose it as: `NEXT_PUBLIC_VAPID_PUBLIC_KEY=<same value>`

### Push — FCM (Firebase Cloud Messaging)

1. Go to Firebase Console → Project Settings → Service Accounts
2. Click "Generate new private key" → download JSON file
3. Encode the file:
```bash
base64 -w 0 path/to/serviceAccountKey.json
```

```env
FCM_SERVICE_ACCOUNT_JSON=eyJ0eXBlIjoic2VydmljZV9hY2NvdW50Iiwixxxxxxxxxxxx...   # base64-encoded
FCM_PROJECT_ID=your-firebase-project-id
```

### Push — OneSignal (free tier, up to 10,000 subscribers)

1. Create app at onesignal.com → Dashboard → Keys & IDs

```env
ONESIGNAL_APP_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
ONESIGNAL_REST_API_KEY=your_rest_api_key_here
```

---

## Step 4 — Activate Providers per Channel

Each tenant must configure which provider handles each channel. This is done via the Providers API. Run these as an admin-authenticated request.

### Activate Email → Resend

```bash
# 1. Register the provider row
POST /api/v1/notifications/settings/providers
{
  "channel_code": "EMAIL",
  "provider_code": "RESEND",
  "display_name": "Resend (Production)",
  "config": {
    "from_email": "noreply@your-domain.com",
    "from_name": "CleanMateX"
  }
}

# 2. Activate it
PUT /api/v1/notifications/settings/providers
{
  "channel_code": "EMAIL",
  "provider_code": "RESEND"
}
```

### Activate SMS → Twilio

```bash
POST /api/v1/notifications/settings/providers
{
  "channel_code": "SMS",
  "provider_code": "TWILIO_SMS",
  "display_name": "Twilio SMS",
  "config": { "from_number": "+14155238886" }
}

PUT /api/v1/notifications/settings/providers
{ "channel_code": "SMS", "provider_code": "TWILIO_SMS" }
```

### Activate WhatsApp → Twilio BSP

```bash
POST /api/v1/notifications/settings/providers
{
  "channel_code": "WHATSAPP",
  "provider_code": "TWILIO_WHATSAPP",
  "display_name": "WhatsApp via Twilio",
  "config": { "from_number": "whatsapp:+14155238886" }
}

PUT /api/v1/notifications/settings/providers
{ "channel_code": "WHATSAPP", "provider_code": "TWILIO_WHATSAPP" }
```

### Activate WhatsApp → Meta Cloud API

```bash
POST /api/v1/notifications/settings/providers
{
  "channel_code": "WHATSAPP",
  "provider_code": "META_WHATSAPP",
  "display_name": "WhatsApp via Meta",
  "config": {
    "phone_number_id": "123456789012345",
    "business_account_id": "your_waba_id"
  }
}

PUT /api/v1/notifications/settings/providers
{ "channel_code": "WHATSAPP", "provider_code": "META_WHATSAPP" }
```

### Activate Push → VAPID

```bash
POST /api/v1/notifications/settings/providers
{
  "channel_code": "PUSH",
  "provider_code": "VAPID",
  "display_name": "Browser Web Push (VAPID)",
  "config": {
    "vapid_public_key": "BKxxxxxxxxxx..."
  }
}

PUT /api/v1/notifications/settings/providers
{ "channel_code": "PUSH", "provider_code": "VAPID" }
```

### Activate Push → OneSignal

```bash
POST /api/v1/notifications/settings/providers
{
  "channel_code": "PUSH",
  "provider_code": "ONESIGNAL",
  "display_name": "OneSignal",
  "config": { "app_id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" }
}

PUT /api/v1/notifications/settings/providers
{ "channel_code": "PUSH", "provider_code": "ONESIGNAL" }
```

> Only **one** provider can be active per channel per tenant. Activating a new one automatically deactivates the previous one.

---

## Step 5 — Enable Channels (per tenant)

After activating providers, enable each channel in the channel settings:

```bash
PUT /api/v1/notifications/settings
{
  "channel_code": "EMAIL",
  "is_enabled": true,
  "quiet_hours_enabled": false
}
```

Repeat for SMS, WHATSAPP, PUSH, IN_APP as needed.

To enable quiet hours (e.g. no notifications 22:00–08:00 Gulf Standard Time):
```bash
PUT /api/v1/notifications/settings
{
  "channel_code": "SMS",
  "is_enabled": true,
  "quiet_hours_enabled": true,
  "quiet_hours_start": "22:00",
  "quiet_hours_end": "08:00",
  "quiet_hours_tz": "Asia/Dubai"
}
```

---

## Step 6 — Register Push Subscriptions (browser/mobile)

The browser or mobile app must call this after the user grants push permission:

```bash
POST /api/notifications/push-subscription
Authorization: Bearer <session-token>
{
  "device_id": "stable-client-generated-uuid",
  "provider_code": "VAPID",
  "platform": "BROWSER",
  "subscription_data": {
    "endpoint": "https://fcm.googleapis.com/...",
    "keys": {
      "p256dh": "BNxxxxxxxxxxxxxxxxxxxxxxxxx",
      "auth": "xxxxxxxxxxxxxxxxxxxxxxxx"
    }
  },
  "app_version": "1.0.0"
}
```

On logout or permission revoke:
```bash
DELETE /api/notifications/push-subscription
Authorization: Bearer <session-token>
{
  "device_id": "stable-client-generated-uuid",
  "provider_code": "VAPID"
}
```

---

## Step 7 — WhatsApp Template Submission (META only)

> **BLOCKING:** Free-form WhatsApp text messages are only allowed within the 24h customer-initiated window. All outbound business-initiated messages require pre-approved templates.

Submit these 5 templates to META Business Manager before enabling WhatsApp:

| Template name | Event | Example body |
|---|---|---|
| `cmx_order_ready` | Order ready for pickup | "Your order #{{1}} is ready for pickup at {{2}}." |
| `cmx_order_cancelled` | Order cancelled | "Your order #{{1}} has been cancelled. Reason: {{2}}." |
| `cmx_payment_received` | Payment confirmed | "Payment of {{1}} {{2}} received for order #{{3}}. Thank you!" |
| `cmx_payment_reminder` | Payment overdue | "Reminder: Your payment of {{1}} {{2}} for order #{{3}} is due." |
| `cmx_order_delayed` | Order delayed | "Your order #{{1}} is delayed. New estimated time: {{2}}." |

Approval typically takes 24–72 hours. Until approved, use Twilio BSP or disable WhatsApp.

---

## Step 8 — Verify the Outbox Processor

The outbox processor is called every minute by pg_cron via pg_net. Verify it is running:

```sql
-- Check pg_cron jobs
SELECT jobname, schedule, active FROM cron.job WHERE jobname LIKE 'ntf%';
-- Expected:
--   ntf-outbox-processor         | * * * * *   | t
--   ntf-outbox-retry             | */5 * * * * | t
--   ntf-sweep-stale-push-subs    | 0 3 * * 0   | t

-- Check recent outbox deliveries
SELECT channel_code, status, COUNT(*) 
FROM org_ntf_outbox_dtl 
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY channel_code, status;

-- Check delivery log
SELECT channel_code, status, error_message, logged_at
FROM org_ntf_delivery_log_dtl
ORDER BY logged_at DESC
LIMIT 20;
```

---

## Step 9 — Smoke Test Checklist

- [ ] **IN_APP:** Trigger an order event → bell icon shows new notification in real-time
- [ ] **EMAIL:** Trigger a transactional event for a user with email → check inbox + delivery log shows SENT
- [ ] **Push (VAPID):** Register a browser subscription → trigger event → notification appears in browser
- [ ] **SMS:** Send a test SMS via the outbox (manually insert a QUEUED row) → check delivery log
- [ ] **Outbox processor:** `POST /api/notifications/process-outbox` with Bearer token → returns `{ processed: N }`
- [ ] **pg_cron sweep:** `SELECT ntf_sweep_stale_push_subs();` → returns `{ deactivated_count: 0 }` (expected 0 on fresh install)

---

## Appendix A — Provider API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/notifications/settings` | All channel settings for tenant |
| PUT | `/api/v1/notifications/settings` | Update channel settings |
| GET | `/api/v1/notifications/settings/providers` | All provider configs (`?channel_code=EMAIL`) |
| POST | `/api/v1/notifications/settings/providers` | Register a new provider |
| PUT | `/api/v1/notifications/settings/providers` | Activate a provider for a channel |
| DELETE | `/api/v1/notifications/settings/providers?channel_code=&provider_code=` | Remove a provider config |
| POST | `/api/notifications/push-subscription` | Register push subscription |
| DELETE | `/api/notifications/push-subscription` | Deregister push subscription |

---

## Appendix B — Provider Selection Logic

When the outbox processor dispatches a row:

1. **SMS / WHATSAPP:** calls `notificationSettingsService.getActiveProvider(tenantOrgId, channel)` → reads `org_ntf_channel_provider_cf` (cached 30s) → dispatches to the active provider sub-adapter
2. **PUSH:** reads active provider → fetches all active subscriptions from `org_ntf_push_subs_dtl` where `provider_code = active.providerCode` → fans out to each subscription → records failure_count on errors
3. **EMAIL:** always uses Resend (`RESEND_API_KEY`)
4. **IN_APP:** written directly to `org_ntf_inbox_mst` by the orchestrator — not via outbox

To switch providers: call `PUT /api/v1/notifications/settings/providers` with the new `provider_code`. The cache invalidates and the next outbox run uses the new provider.

---

## Appendix C — Switching Providers Without Downtime

1. Register the new provider (`POST /providers`) — does not affect live traffic
2. Configure its ENV vars in your deployment (redeploy if needed)
3. Activate: `PUT /providers` with new provider_code — atomic two-step in DB, takes effect within 30s (cache TTL)
4. Verify first delivery in the delivery log
5. Old provider row remains inactive (can delete or keep for audit)

---

## Appendix D — Stale Push Subscription Sweep

pg_cron job `ntf-sweep-stale-push-subs` runs every Sunday at 03:00 UTC. It deactivates subscriptions where:
- `failure_count > 3` — repeated delivery rejections
- `last_verified_at < NOW() - INTERVAL '90 days'` — likely expired token (app uninstall)
- `last_verified_at IS NULL AND created_at < NOW() - INTERVAL '90 days'` — never delivered to

To run manually:
```sql
SELECT ntf_sweep_stale_push_subs();
```

Clients should re-register their subscription on each app launch (`POST /api/notifications/push-subscription` is idempotent — it upserts and resets `failure_count`).
