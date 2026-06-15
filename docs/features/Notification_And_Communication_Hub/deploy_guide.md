# CMX-PRD-019 — Notification Hub: Deployment Guide

**Last Updated:** 2026-06-12  
**Audience:** DevOps, SREs, and senior developers deploying or maintaining the Notification Hub  
**Status:** Phases 1–4 complete (cleanmatex MVP)

---

## 1. Prerequisites

Before deploying the Notification Hub:

- [ ] Supabase project running (local or remote)
- [ ] `pg_cron` extension enabled in Supabase
- [ ] `pg_net` extension enabled in Supabase
- [ ] `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` set
- [ ] At minimum one email provider credential (Resend recommended)
- [ ] `NOTIFICATIONS_OUTBOX_SECRET` generated (random 32+ char string)

---

## 2. Migration Sequence

Apply migrations **in strict order**. Never skip a migration. Never apply out of order.

| Seq | File | Purpose | Phase |
|-----|------|---------|-------|
| 0344 | `notif_catalog_schema.sql` | Catalog tables: categories, events, event-channel mapping | 1 |
| 0345 | `notif_catalog_seed.sql` | Seed 27 categories + 116 events | 1 |
| 0346 | `notif_templates_schema.sql` | Template schema + sys_ntf_providers_cd | 1 |
| 0347 | `notif_tenant_settings.sql` | Tenant channel config + user prefs (RLS) | 1 |
| 0348 | `notif_runtime_tables.sql` | Inbox + outbox + delivery log + Realtime | 1 |
| 0349 | `ntf_permissions_and_nav.sql` | Permissions seed + sys_components_cd nav | 1 |
| 0350 | `ntf_outbox_cron.sql` | pg_cron + pg_net outbox processor + retry jobs | 2 |
| 0351 | `notif_push_subscriptions.sql` | org_ntf_push_subs_dtl + RLS | 3 |
| 0352 | `notif_channel_provider_cf.sql` | org_ntf_channel_provider_cf + provider seeds | 3 |
| 0353 | `notif_push_sweep_cron.sql` | Weekly push subscription stale sweep | 3 |
| 0355 | `ntf_config_table_cron_fix.sql` | sys_ntf_runtime_cf + cron GUC workaround | 3 |
| 0356 | `ntf_provider_cf_is_enabled.sql` | is_enabled column + audit cols on provider_cf | 3 |
| 0361 | `ntf_campaign_engine_tables.sql` | Campaign + targets + usage + audit tables | 4 |
| 0362 | `ntf_campaign_scheduler_cron.sql` | Campaign scheduler pg_cron job (every 1 min) | 4 |
| 0363 | `nav_marketing_campaigns.sql` | Campaigns nav entry + sys_components_cd + permission | 4 |

> **RULE:** Apply each file, verify success, then proceed to the next. Never run all at once on a new environment without checking intermediate state.

---

## 3. Environment Variables

Add to `.env.local` (local dev) or your deployment secrets manager.

### Core (required for all channels)

```env
# Supabase (already present)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Notification Hub security
NOTIFICATIONS_OUTBOX_SECRET=your-random-32char-secret   # guards /api/notifications/process-outbox AND /api/notifications/process-campaigns
```

### Email (Resend — required for EMAIL channel)

```env
RESEND_API_KEY=re_your_resend_api_key
```

Configure `from_email` in the provider config table (not in env):
```sql
-- The from_email is stored in org_ntf_channel_provider_cf.config JSONB
-- e.g.: {"from_email": "noreply@cmx.cleanmatex.com"}
```

### SMS (Twilio — required for SMS channel)

```env
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your-twilio-auth-token
TWILIO_SMS_FROM=+19695550100
```

### WhatsApp — Twilio BSP

```env
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
```

### WhatsApp — Meta Cloud API (direct)

```env
META_WHATSAPP_ACCESS_TOKEN=your-permanent-token
META_WHATSAPP_PHONE_NUMBER_ID=your-phone-number-id
```

### Push Notifications — VAPID (Web Push)

```env
VAPID_PUBLIC_KEY=your-vapid-public-key
VAPID_PRIVATE_KEY=your-vapid-private-key
VAPID_SUBJECT=mailto:admin@cleanmatex.com
NEXT_PUBLIC_VAPID_PUBLIC_KEY=same-as-VAPID_PUBLIC_KEY   # must be public
```

Generate VAPID keys (one-time):
```bash
cd web-admin
npx web-push generate-vapid-keys
```

### Push Notifications — FCM

```env
FCM_SERVICE_ACCOUNT_JSON={"type":"service_account",...}   # base64 or raw JSON
FCM_PROJECT_ID=your-firebase-project-id
```

### Push Notifications — OneSignal

```env
ONESIGNAL_APP_ID=your-onesignal-app-id
ONESIGNAL_REST_API_KEY=your-onesignal-rest-api-key
```

---

## 4. Runtime Config Table

Migration 0355 creates `sys_ntf_runtime_cf` (a key/value store used by pg_cron since `postgres` role cannot set GUCs in Supabase):

```sql
-- After deployment, insert/update runtime config
INSERT INTO sys_ntf_runtime_cf (key, value) VALUES
  ('next_js_base_url', 'https://your-deployed-domain.com'),
  ('outbox_secret_key', 'same-value-as-NOTIFICATIONS_OUTBOX_SECRET')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
```

> **Important:** `outbox_secret_key` in this table must match `NOTIFICATIONS_OUTBOX_SECRET` in your env vars exactly. The pg_cron job reads from this table to call the outbox processor.

---

## 5. pg_cron Job Verification

After applying migrations, verify all 3 cron jobs are registered:

```sql
SELECT jobid, schedule, command, jobname, active
FROM cron.job
WHERE jobname LIKE 'ntf%';
```

Expected results:

| jobname | schedule | active |
|---------|----------|--------|
| `ntf-outbox-processor` | `* * * * *` (every minute) | true |
| `ntf-outbox-retry` | `*/5 * * * *` (every 5 minutes) | true |
| `ntf-push-sweep` | `0 3 * * 0` (Sundays 03:00 UTC) | true |

Check recent run status:
```sql
SELECT jobname, status, return_message, start_time, end_time
FROM cron.job_run_details
WHERE jobname LIKE 'ntf%'
ORDER BY start_time DESC
LIMIT 15;
```

All should show `status = succeeded`. If `failed`, check `return_message` — usually a 401 (wrong outbox secret in runtime config) or a network error (wrong base URL).

---

## 6. Provider Activation

Run the provider activation SQL after migrations are applied. Located at:  
`docs/features/Notification_And_Communication_Hub/Setup_And_Config/sql_scripts/02_activate_providers_and_channels.sql`

This script:
1. Inserts provider records into `org_ntf_channel_provider_cf` for all active tenants
2. Enables the IN_APP and EMAIL channels by default
3. Registers SMS, WhatsApp, PUSH providers as inactive (must be manually activated per-tenant)

**Manual channel activation per tenant (SQL):**

```sql
-- Enable EMAIL channel for a specific tenant
UPDATE org_notification_settings_cf
SET is_enabled = true, updated_at = NOW()
WHERE tenant_org_id = 'your-tenant-uuid'
  AND channel_code = 'EMAIL';

-- Activate EMAIL → RESEND provider
UPDATE org_ntf_channel_provider_cf
SET is_active = true, is_enabled = true, updated_at = NOW()
WHERE tenant_org_id = 'your-tenant-uuid'
  AND channel_code = 'EMAIL'
  AND provider_code = 'RESEND';
```

---

## 7. Service Worker Deployment (Push Notifications)

The VAPID service worker must be accessible at `https://your-domain.com/sw.js` (root path required for scope).

File location: `web-admin/public/sw.js`

It is automatically served by Next.js from the `public/` directory. No additional configuration needed.

**Test service worker registration:**
1. Open DevTools → Application → Service Workers
2. Confirm `sw.js` is registered and active
3. Scope should be `/` (not a subdirectory)

---

## 8. Supabase Realtime Verification

Verify `org_notifications_mst` is included in the Realtime publication:

```sql
SELECT tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
  AND tablename = 'org_notifications_mst';
```

Expected: one row. If missing, run:

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE org_notifications_mst;
```

Verify `REPLICA IDENTITY FULL`:
```sql
SELECT relreplident
FROM pg_class
WHERE relname = 'org_notifications_mst';
```

Expected: `f` (FULL). If not:
```sql
ALTER TABLE org_notifications_mst REPLICA IDENTITY FULL;
```

---

## 9. Navigation & Permissions

The migration `0349_ntf_permissions_and_nav.sql` seeds:
- 5 permission codes into `sys_auth_permissions`
- Default role assignments in `sys_auth_role_default_permissions`
- 4 navigation entries in `sys_components_cd`

Verify after applying:
```sql
SELECT code FROM sys_auth_permissions WHERE code LIKE 'notifications:%';
-- Expected: notifications:read, notifications:manage, notifications:view_log,
--           notifications:configure, notifications:send_test

SELECT comp_code FROM sys_components_cd WHERE comp_code LIKE 'notification%';
-- Expected: notifications, notifications_center, notifications_delivery_log,
--           notifications_settings
```

---

## 10. Post-Deployment Checklist

- [ ] All 13 migrations applied in sequence (0344–0356)
- [ ] `sys_ntf_runtime_cf` populated with `next_js_base_url` and `outbox_secret_key`
- [ ] All required env vars set in deployment secrets
- [ ] Provider activation SQL run for all active tenants
- [ ] pg_cron jobs verified: 3 active jobs with `succeeded` status
- [ ] Supabase Realtime: `org_notifications_mst` in publication
- [ ] Service worker `/sw.js` accessible in browser (push channels only)
- [ ] Smoke test: IN_APP bell increments on new notification (see `Setup_And_Config/11_smoke_tests.md`)
- [ ] Smoke test: EMAIL delivered end-to-end
- [ ] Navigation: Notification Center, Delivery Log, Settings appear in sidebar for admin role

---

## 11. Rollback Notes

There is no automated rollback for these migrations. If a migration fails mid-way:

1. Do NOT re-run the partial migration
2. Write a NEW corrective migration (CLAUDE.md rule: never modify existing migrations)
3. Check `supabase/migrations/` for the highest sequence number and use `{max+1}` for the fix

If you need to disable the notification system entirely without rolling back:

```sql
-- Disable all channels for all tenants (no data loss)
UPDATE org_notification_settings_cf SET is_enabled = false WHERE true;

-- Pause pg_cron jobs
UPDATE cron.job SET active = false WHERE jobname LIKE 'ntf%';
```

---

## 12. WhatsApp Template Submission (Blocking for Live WhatsApp)

Before WhatsApp channel goes live, 5 META templates must be approved:

| Template Name | Message |
|--------------|---------|
| `cmx_order_ready` | "Your order #{order_number} is ready for pickup at {branch_name}." |
| `cmx_order_cancelled` | "Your order #{order_number} has been cancelled." |
| `cmx_payment_received` | "Payment of {amount} {currency} received for order #{order_number}." |
| `cmx_payment_reminder` | "Reminder: payment of {amount} is pending for order #{order_number}." |
| `cmx_order_delayed` | "Your order #{order_number} is delayed. New ETA: {estimated_time}." |

Submit via META Business Manager. Approval takes 2–7 business days. Track approval status in STATUS.md.

See `Setup_And_Config/09_whatsapp_templates.md` for full submission guide.
