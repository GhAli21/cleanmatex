# CMX-PRD-019 — Notification & Communication Hub
# STATUS

**Last Updated:** 2026-06-11
**Next migration seq:** 0353

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

## PHASE 3 — WhatsApp + SMS + Push Notifications 🔄 IN PROGRESS (2026-06-11)

- [x] Step 3.1 — Migration 0351: org_notif_push_subs_dtl + provider seeds (RESEND, VAPID, ONESIGNAL, META_WHATSAPP) ✅ Applied
- [x] Step 3.2 — Migration 0352: org_ntf_channel_provider_cf ✅ Applied
- [x] Step 3.3 — NotificationSettingsService (source of truth, 30s cache)
- [x] Step 3.4 — Provider Settings API Routes (GET/POST/PUT/DELETE providers)
- [ ] Step 3.5 — Push Subscription API Routes (register/deregister)
- [ ] Step 3.6 — Push Adapter (VAPID/FCM/OneSignal factory pattern)
- [ ] Step 3.7 — WhatsApp Adapter (META_WHATSAPP + TWILIO_WHATSAPP)
- [ ] Step 3.8 — SMS Adapter (TWILIO_SMS)
- [ ] Step 3.9 — Weekly pg_cron sweep: deactivate stale push subscriptions

**WhatsApp template pre-submission (BLOCKING for WhatsApp adapter):**
- cmx_order_ready, cmx_order_cancelled, cmx_payment_received, cmx_payment_reminder, cmx_order_delayed
- Submitted date: [PENDING]

---

## PHASE 4 — Campaign Engine ⏳ NOT STARTED

---

## Migration Registry

| Seq  | File                              | Status     | Applied    |
|------|-----------------------------------|------------|------------|
| 0344 | notif_catalog_schema              | ✅ Applied  | 2026-06-06 |
| 0345 | notif_catalog_seed                | ✅ Applied  | 2026-06-06 |
| 0346 | notif_templates_schema            | ✅ Applied  | 2026-06-06 |
| 0347 | notif_tenant_settings             | ✅ Applied  | 2026-06-06 |
| 0348 | notif_runtime_tables              | ✅ Applied  | 2026-06-06 |
| 0349 | notif_permissions_and_nav         | ✅ Applied  | 2026-06-11 |
| 0350 | notif_outbox_cron                 | ✅ Applied  | 2026-06-11 |
| 0351 | notif_push_subscriptions          | ✅ Applied  | 2026-06-11 |
| 0352 | notif_channel_provider_cf         | ✅ Applied  | 2026-06-11 |
