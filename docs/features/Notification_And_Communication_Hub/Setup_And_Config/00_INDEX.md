# Notification & Communication Hub — Setup & Config Index

**Last Updated:** 2026-06-11  
**PRD:** CMX-PRD-019  
**Purpose:** Master index and recommended reading order for all Notification Hub setup documentation. Each file is self-contained; follow the reading order for a fresh deployment.

---

## Prerequisites

- Supabase project with `pg_cron` and `pg_net` extensions enabled (Supabase Pro or above)
- Next.js `web-admin` app deployed or running locally
- Admin access to Supabase SQL Editor and project dashboard
- Access to deployment secrets manager (Vercel, Railway, or `.env.local`)

---

## Reading Order — Fresh Deployment

| # | File | What it covers |
|---|------|----------------|
| 1 | [01_migrations.md](./01_migrations.md) | Apply all 10 DB migrations in order + verify |
| 2 | [02_supabase_gucs.md](./02_supabase_gucs.md) | Set `app.next_js_base_url` and `app.outbox_secret_key` GUCs |
| 3 | [03_env_vars.md](./03_env_vars.md) | Full ENV var reference for all channels and providers |
| 4 | [04_provider_activation.md](./04_provider_activation.md) | Activate the provider for each channel via API |
| 5 | [05_channel_settings.md](./05_channel_settings.md) | Enable channels + configure quiet hours per tenant |
| 6 | [06_vapid_keygen.md](./06_vapid_keygen.md) | Generate VAPID keys + browser service worker snippet |
| 7 | [07_fcm_setup.md](./07_fcm_setup.md) | Firebase project → service account JSON → ENV var |
| 8 | [08_onesignal_setup.md](./08_onesignal_setup.md) | OneSignal free tier → App ID + REST key |
| 9 | [09_whatsapp_templates.md](./09_whatsapp_templates.md) | META template submission (EN + AR) — BLOCKING for WhatsApp |
| 10 | [10_push_subscription_client.md](./10_push_subscription_client.md) | Browser-side push permission + subscription JS code |
| 11 | [11_smoke_tests.md](./11_smoke_tests.md) | Per-channel smoke test procedure + SQL test harness |
| 12 | [12_provider_switching.md](./12_provider_switching.md) | Zero-downtime provider switch + rollback |

---

## Quick-Start (minimum for EMAIL only)

If you only need email notifications to work:
1. `01_migrations.md` — apply all migrations
2. `02_supabase_gucs.md` — set both GUCs
3. `03_env_vars.md` — set `NOTIFICATIONS_OUTBOX_SECRET` + `RESEND_API_KEY` only
4. `04_provider_activation.md` — activate EMAIL → RESEND section only
5. `05_channel_settings.md` — enable EMAIL channel only
6. `11_smoke_tests.md` — EMAIL smoke test section

---

## Channel → Required Files

| Channel | Required setup files |
|---------|---------------------|
| IN_APP | 01, 02, 03 (outbox secret only) |
| EMAIL | 01, 02, 03, 04 (RESEND section), 05 |
| SMS | 01, 02, 03 (Twilio section), 04 (SMS section), 05 |
| WHATSAPP (Twilio BSP) | 01, 02, 03, 04 (WA-Twilio section), 05, 09 |
| WHATSAPP (Meta) | 01, 02, 03, 04 (WA-Meta section), 05, 09 |
| PUSH (VAPID) | 01, 02, 03, 04 (VAPID section), 05, 06, 10 |
| PUSH (FCM) | 01, 02, 03, 04 (FCM section), 05, 07, 10 |
| PUSH (OneSignal) | 01, 02, 03, 04 (OS section), 05, 08, 10 |

---

## Key Technical Facts

| Item | Value |
|------|-------|
| Outbox processor endpoint | `POST /api/notifications/process-outbox` |
| Auth header | `Authorization: Bearer {NOTIFICATIONS_OUTBOX_SECRET}` |
| Settings cache TTL | 30 seconds (module-level Map in Node.js) |
| Push subscriptions table | `org_notif_push_subs_dtl` |
| Channel provider config table | `org_ntf_channel_provider_cf` |
| pg_cron job — outbox dispatch | `ntf-outbox-processor` (every minute) |
| pg_cron job — retry | `ntf-outbox-retry` (every 5 minutes) |
| pg_cron job — push sweep | `ntf-sweep-stale-push-subs` (Sunday 03:00 UTC) |
| SMS provider code | `TWILIO_SMS` |
| WhatsApp Twilio provider code | `TWILIO_WHATSAPP` |
| WhatsApp Meta provider code | `META_WHATSAPP` |
