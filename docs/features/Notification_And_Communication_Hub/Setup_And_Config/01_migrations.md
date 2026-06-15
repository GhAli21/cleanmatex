# Notification Hub — Database Migrations

**Last Updated:** 2026-06-11  
**Purpose:** Apply all 10 required migrations in order. Includes verification SQL and notes on what each migration creates.

**Prerequisites:** Supabase project with `pg_cron` and `pg_net` extensions enabled.

---

## Migration Sequence

Apply via Supabase dashboard (SQL Editor) or CLI (`supabase db push`). **Never skip. Never re-apply a migration that is already applied.**

| Seq | File | What it creates |
|-----|------|----------------|
| 0344 | `0344_notif_catalog_schema.sql` | `sys_notif_categories_cd`, `sys_notification_events_cd`, `sys_notif_event_channel_defaults`. Adds `WEB_SOCKET` to `sys_ntf_channel_cd`. |
| 0345 | `0345_notif_catalog_seed.sql` | Seeds 27 categories and 116 notification events. |
| 0346 | `0346_ntf_templates_schema.sql` | `sys_ntf_providers_cd` (provider catalog), `sys_ntf_templates_mst`, `sys_ntf_template_ver_dtl`, `sys_ntf_template_chan_dtl`. Seeds initial providers: INTERNAL, SUPABASE_REALTIME, SENDGRID, TWILIO_SMS, TWILIO_WHATSAPP, FCM. |
| 0347 | `0347_ntf_tenant_settings.sql` | `org_ntf_settings_cf` (per-tenant channel config), `org_ntf_user_prefs_dtl` (per-user preferences). |
| 0348 | `0348_ntf_runtime_tables.sql` | `org_ntf_inbox_mst` (in-app inbox), `org_ntf_outbox_dtl` (delivery queue), `org_ntf_delivery_log_dtl` (audit trail). Enables Supabase Realtime on `org_ntf_inbox_mst`. |
| 0349 | `0349_ntf_permissions_and_nav.sql` | Seeds 5 permissions into `sys_auth_permissions`. Seeds 4 navigation entries into `sys_components_cd`. |
| 0350 | `0350_ntf_outbox_cron.sql` | Schedules two pg_cron jobs: `ntf-outbox-processor` (every minute) and `ntf-outbox-retry` (every 5 minutes). Uses `pg_net` to call the outbox API endpoint. |
| 0351 | `0351_notif_push_subscriptions.sql` | `org_ntf_push_subs_dtl` (provider-agnostic push subscription registry). Seeds 4 additional providers: RESEND, VAPID, ONESIGNAL, META_WHATSAPP. |
| 0352 | `0352_notif_channel_provider_cf.sql` | `org_ntf_channel_provider_cf` (per-tenant channel→provider mapping; partial unique index ensures exactly one active provider per channel). |
| 0353 | `0353_notif_push_sweep_cron.sql` | Creates `ntf_sweep_stale_push_subs()` function. Schedules `ntf-sweep-stale-push-subs` pg_cron job (every Sunday 03:00 UTC). |

---

## Apply Order

```sql
-- Run each file's content in the Supabase SQL Editor in this exact order:
-- 0344 → 0345 → 0346 → 0347 → 0348 → 0349 → 0350 → 0351 → 0352 → 0353
```

Via CLI:
```bash
cd f:/jhapp/cleanmatex
supabase db push
```

---

## Verification Queries

Run these after all migrations are applied:

```sql
-- 1. Channels present (should return 6 rows)
SELECT code, name FROM sys_ntf_channel_cd ORDER BY code;
-- EMAIL, IN_APP, PUSH, SMS, WEB_SOCKET, WHATSAPP

-- 2. Providers present (should return 10 rows)
SELECT code, channel_code, display_order FROM sys_ntf_providers_cd ORDER BY display_order;
-- INTERNAL(1), SUPABASE_REALTIME(2), SENDGRID(3), TWILIO_SMS(4), TWILIO_WHATSAPP(5),
-- FCM(6), RESEND(7), VAPID(8), ONESIGNAL(9), META_WHATSAPP(10)

-- 3. pg_cron jobs active (should return 3 rows)
SELECT jobname, schedule, active FROM cron.job WHERE jobname LIKE 'ntf%';
-- ntf-outbox-processor  | * * * * *   | t
-- ntf-outbox-retry      | */5 * * * * | t
-- ntf-sweep-stale-push-subs | 0 3 * * 0 | t

-- 4. Runtime tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'org_ntf_inbox_mst', 'org_ntf_outbox_dtl', 'org_ntf_delivery_log_dtl',
    'org_ntf_settings_cf', 'org_ntf_user_prefs_dtl',
    'org_ntf_push_subs_dtl', 'org_ntf_channel_provider_cf'
  )
ORDER BY table_name;
-- Should return all 7 table names

-- 5. RLS enabled on all org_ tables
SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname = 'public'
  AND tablename LIKE 'org_ntf%'
ORDER BY tablename;
-- All rows should have rowsecurity = true

-- 6. Notification permissions seeded
SELECT code FROM sys_auth_permissions WHERE code LIKE 'notifications:%' ORDER BY code;
-- notifications:read, notifications:write, notifications:manage,
-- notifications:settings_manage, notifications:delivery_log_view
```

---

## What Each Migration Adds to org_ntf_channel_provider_cf

Migration 0352 creates the table with **no rows** — rows are added per-tenant when you activate a provider via the API (see [04_provider_activation.md](./04_provider_activation.md)).

---

## Rollback Notes

These migrations have no rollback scripts — they are additive only (new tables, new lookup rows, new functions). If you need to undo:
1. Drop the tables in reverse order (0353 → 0344)
2. Remove the pg_cron jobs: `SELECT cron.unschedule('ntf-outbox-processor'); SELECT cron.unschedule('ntf-outbox-retry'); SELECT cron.unschedule('ntf-sweep-stale-push-subs');`
3. Remove the provider rows from `sys_ntf_providers_cd` (codes: RESEND, VAPID, ONESIGNAL, META_WHATSAPP)
4. Remove the `WEB_SOCKET` row from `sys_ntf_channel_cd`

> Rollback is only needed if you are removing the feature entirely. For bug fixes, always create a new migration (never modify existing ones).
