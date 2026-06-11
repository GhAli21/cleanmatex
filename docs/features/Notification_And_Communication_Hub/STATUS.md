# CMX-PRD-019 — Notification & Communication Hub
# STATUS

**Last Updated:** 2026-06-11
**Next migration seq:** 0354
**Phase 3 closed:** 2026-06-11

---

## PHASE 1 — Foundation + In-App Notifications ✅ COMPLETE (2026-06-11)

- [x] Step 1.1 — Migration 0344: Event Catalog Schema
- [x] Step 1.2 — Migration 0345: Event Catalog Seed
- [x] Step 1.3 — Migration 0346: Template Schema
- [x] Step 1.4 — Migration 0347: Tenant Settings
- [x] Step 1.5 — Migration 0348: Runtime Tables
- [x] Step 1.6 — Migration 0349: Permissions + Navigation Dual-Write
- [x] Step 1.7 — Navigation Frontend (navigation.ts)
- [x] Step 1.9 — Notification Library (types, orchestrator, adapters)
- [x] Step 1.10 — API Routes (notifications CRUD)

---

## PHASE 2 — Email + Preferences UI + Outbox Worker ✅ COMPLETE (2026-06-11)

- [x] Step 2.2 — Migration 0350: pg_cron + pg_net outbox processor
- [x] Step 2.3 — Email Adapter (Resend via existing email-sender.ts)
- [x] Step 2.4 — Outbox Processor API Route (POST /api/notifications/process-outbox)
- [x] Step 2.5 — Quiet Hours + Marketing Consent in Orchestrator
- [x] Step 2.6 — Preferences UI (NotificationSettingsPage, DeliveryLogPage)
- [x] API Routes: GET/PUT /api/v1/notifications/settings
- [x] API Routes: GET/PUT /api/v1/notifications/user-prefs
- [x] API Routes: GET /api/v1/notifications/delivery-log
- [x] i18n: notifications.settings + notifications.deliveryLog (EN + AR)
- [x] Build: npm run build green

**ENV vars required:**
- NOTIFICATIONS_OUTBOX_SECRET — must match app.outbox_secret_key GUC in Supabase
- RESEND_API_KEY — existing

**GUCs to set in Supabase (run manually):**
  ALTER DATABASE postgres SET app.next_js_base_url = 'https://your-app-url.com';
  ALTER DATABASE postgres SET app.outbox_secret_key = 'your-secret-here';

---

## PHASE 3 — WhatsApp + SMS + Push Notifications ✅ COMPLETE (2026-06-11)

- [x] Step 3.1 — Migration 0351: org_notif_push_subs_dtl + provider seeds (RESEND, VAPID, ONESIGNAL, META_WHATSAPP) ✅ Applied
- [x] Step 3.2 — Migration 0352: org_ntf_channel_provider_cf ✅ Applied
- [x] Step 3.3 — NotificationSettingsService (source of truth, 30s cache)
- [x] Step 3.4 — Provider Settings API Routes (GET/POST/PUT/DELETE /api/v1/notifications/settings/providers)
- [x] Step 3.5 — SMS Adapter (lib/notifications/adapters/sms.ts — Twilio)
- [x] Step 3.6 — WhatsApp Adapter (lib/notifications/adapters/whatsapp.ts — TWILIO_WHATSAPP + META_WHATSAPP factory)
- [x] Step 3.7 — Push Adapter Factory:
  - [x] adapters/push/vapid.ts (W3C Web Push via web-push npm)
  - [x] adapters/push/fcm.ts (FCM v1 HTTP + JWT; no Firebase SDK)
  - [x] adapters/push/onesignal.ts (OneSignal REST API)
  - [x] adapters/push.ts (main factory — reads active provider, fan-out to all subscriptions)
- [x] Step 3.8 — Push Subscription API (POST/DELETE /api/notifications/push-subscription)
- [x] Step 3.9 — Outbox Processor wired: EMAIL + SMS + WHATSAPP + PUSH channels
- [x] Step 3.10 — Migration 0353: ntf_sweep_stale_push_subs pg_cron job ✅ Applied
- [x] Build: npm run build green ✅

**Pending: WhatsApp template pre-submission (BLOCKING for live WhatsApp sends):**
- cmx_order_ready, cmx_order_cancelled, cmx_payment_received, cmx_payment_reminder, cmx_order_delayed
- Submitted date: [PENDING]

**ENV vars required (Phase 3):**
- SMS:       TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_SMS_FROM
- WhatsApp (Twilio BSP):  TWILIO_WHATSAPP_FROM
- WhatsApp (Meta direct): META_WHATSAPP_ACCESS_TOKEN, META_WHATSAPP_PHONE_NUMBER_ID
- Push VAPID:             VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
- Push FCM:               FCM_SERVICE_ACCOUNT_JSON, FCM_PROJECT_ID
- Push OneSignal:         ONESIGNAL_APP_ID, ONESIGNAL_REST_API_KEY

---

## PHASE 4 — Campaign Engine ⏳ NOT STARTED

---

## Migration Registry

| Seq  | File                              | Status              | Applied    |
|------|-----------------------------------|---------------------|------------|
| 0344 | notif_catalog_schema              | ✅ Applied           | 2026-06-06 |
| 0345 | notif_catalog_seed                | ✅ Applied           | 2026-06-06 |
| 0346 | notif_templates_schema            | ✅ Applied           | 2026-06-06 |
| 0347 | notif_tenant_settings             | ✅ Applied           | 2026-06-06 |
| 0348 | notif_runtime_tables              | ✅ Applied           | 2026-06-06 |
| 0349 | notif_permissions_and_nav         | ✅ Applied           | 2026-06-11 |
| 0350 | notif_outbox_cron                 | ✅ Applied           | 2026-06-11 |
| 0351 | notif_push_subscriptions          | ✅ Applied           | 2026-06-11 |
| 0352 | notif_channel_provider_cf         | ✅ Applied           | 2026-06-11 |
| 0353 | notif_push_sweep_cron             | ✅ Applied           | 2026-06-11 |
