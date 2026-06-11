# Notification Hub — Smoke Tests

**Last Updated:** 2026-06-11  
**Purpose:** Per-channel smoke test procedure with exact SQL test harness and expected outcomes.

**Prerequisites:** All migrations applied, GUCs set, at least one channel enabled and its provider activated.

---

## Test Harness — Manually Insert Outbox Row

Replace `<tenant_id>` and `<user_id>` with real UUIDs from your `org_tenants_mst` / `auth.users`.

```sql
-- Generic outbox insert for any channel
INSERT INTO org_ntf_outbox_dtl (
  id, tenant_org_id, channel_code,
  recipient_address, recipient_user_id,
  rendered_subject, rendered_body,
  event_code, status, retry_count, max_retries,
  scheduled_at, rec_status
) VALUES (
  gen_random_uuid(),
  '<tenant_id>',
  'EMAIL',                         -- change per test
  'test@example.com',              -- for EMAIL/SMS/WHATSAPP
  '<user_id>',                     -- for PUSH/IN_APP
  'Test Notification Subject',
  'This is a test notification body sent from the smoke test harness.',
  'order.status_changed',
  'QUEUED',
  0,
  3,
  NOW(),                           -- scheduled_at = now = dispatch immediately
  1
);
```

Then trigger the processor manually:

```bash
curl -X POST https://your-domain.com/api/notifications/process-outbox \
  -H "Authorization: Bearer YOUR_NOTIFICATIONS_OUTBOX_SECRET"
```

Or call it from the Supabase SQL Editor via pg_net:

```sql
SELECT net.http_post(
  url     := current_setting('app.next_js_base_url') || '/api/notifications/process-outbox',
  headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.outbox_secret_key')),
  body    := '{}'::jsonb
);
```

---

## Check Delivery Results

```sql
-- View latest outbox status
SELECT id, channel_code, status, error_message, sent_at, retry_count, updated_at
FROM org_ntf_outbox_dtl
ORDER BY updated_at DESC
LIMIT 20;

-- View delivery log
SELECT channel_code, status, attempt_number, error_message, logged_at
FROM org_ntf_delivery_log_dtl
ORDER BY logged_at DESC
LIMIT 20;
```

---

## Channel: IN_APP

```sql
-- Insert directly into inbox (orchestrator does this; not via outbox)
INSERT INTO org_ntf_inbox_mst (
  id, tenant_org_id, recipient_user_id,
  event_code, category_code,
  title, title2, body, body2,
  is_read, is_active, rec_status, created_at
) VALUES (
  gen_random_uuid(), '<tenant_id>', '<user_id>',
  'order.status_changed', 'ORDER',
  'Test Notification', 'إشعار اختباري',
  'Your order is ready', 'طلبك جاهز',
  false, true, 1, NOW()
);
```

Expected: The notification bell in the web-admin sidebar shows `1 unread`. Supabase Realtime pushes the update in real-time (within 1 second).

---

## Channel: EMAIL

```sql
INSERT INTO org_ntf_outbox_dtl (
  id, tenant_org_id, channel_code,
  recipient_address, recipient_user_id,
  rendered_subject, rendered_body,
  event_code, status, retry_count, max_retries, scheduled_at, rec_status
) VALUES (
  gen_random_uuid(), '<tenant_id>', 'EMAIL',
  'recipient@example.com', '<user_id>',
  'CleanMateX Smoke Test', '<p>This is a <strong>smoke test</strong> email from CleanMateX.</p>',
  'order.status_changed', 'QUEUED', 0, 3, NOW(), 1
);
```

Expected after processor run:
- Outbox row status → `SENT`
- Delivery log: `status = SENT`
- Email arrives in `recipient@example.com` inbox within 1–2 minutes

If `FAILED_PERMANENT`: check `error_message` — likely invalid `RESEND_API_KEY` or `from_email` domain not verified in Resend.

---

## Channel: SMS

```sql
INSERT INTO org_ntf_outbox_dtl (
  id, tenant_org_id, channel_code,
  recipient_address, recipient_user_id,
  rendered_subject, rendered_body,
  event_code, status, retry_count, max_retries, scheduled_at, rec_status
) VALUES (
  gen_random_uuid(), '<tenant_id>', 'SMS',
  '+96891234567', '<user_id>',
  NULL, 'CleanMateX smoke test: Your order ORD-2026-00001 is ready.',
  'order.status_changed', 'QUEUED', 0, 3, NOW(), 1
);
```

Expected:
- Outbox row status → `SENT`
- SMS arrives on the recipient phone within 30 seconds

Common failures:
| Error | Cause | Fix |
|-------|-------|-----|
| `FAILED_PERMANENT` + Twilio code 21211 | Invalid phone number format | Use E.164 format: `+96891234567` |
| `FAILED_TEMPORARY` + 401 | Wrong TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN | Verify in Twilio Console |
| SMS never arrives | Provider `TWILIO_SMS` not activated | Run [04_provider_activation.md](./04_provider_activation.md) |

---

## Channel: WHATSAPP

```sql
INSERT INTO org_ntf_outbox_dtl (
  id, tenant_org_id, channel_code,
  recipient_address, recipient_user_id,
  rendered_subject, rendered_body,
  event_code, status, retry_count, max_retries, scheduled_at, rec_status
) VALUES (
  gen_random_uuid(), '<tenant_id>', 'WHATSAPP',
  '+96891234567', '<user_id>',
  NULL, 'CleanMateX: Your order ORD-2026-00001 is ready for pickup.',
  'order.status_changed', 'QUEUED', 0, 3, NOW(), 1
);
```

Expected: WhatsApp message delivered within 10 seconds.

> During testing (before META template approval), free-form messages only work within a 24-hour window after the recipient contacts your WhatsApp number first. For production, use the pre-approved templates via the orchestrator.

---

## Channel: PUSH

```sql
-- First verify you have an active subscription for the test user
SELECT id, provider_code, platform, last_verified_at, failure_count
FROM org_notif_push_subs_dtl
WHERE tenant_org_id = '<tenant_id>'
  AND user_id = '<user_id>'
  AND is_active = true;
```

```sql
INSERT INTO org_ntf_outbox_dtl (
  id, tenant_org_id, channel_code,
  recipient_address, recipient_user_id,
  rendered_subject, rendered_body,
  event_code, status, retry_count, max_retries, scheduled_at, rec_status
) VALUES (
  gen_random_uuid(), '<tenant_id>', 'PUSH',
  NULL, '<user_id>',
  'Order Ready', 'Your order ORD-2026-00001 is ready for pickup.',
  'order.status_changed', 'QUEUED', 0, 3, NOW(), 1
);
```

Expected:
- Browser (VAPID): push notification appears in OS notification center
- Mobile (FCM): notification appears in device notification tray
- Outbox status → `SENT` (if at least one subscription succeeded)

Check subscription failure tracking:
```sql
SELECT id, provider_code, failure_count, is_active, last_verified_at
FROM org_notif_push_subs_dtl
WHERE tenant_org_id = '<tenant_id>'
  AND user_id = '<user_id>'
ORDER BY updated_at DESC;
```

---

## Verify pg_cron Jobs Are Running

```sql
-- Check last 5 runs of the outbox processor
SELECT jobname, status, return_message, start_time, end_time
FROM cron.job_run_details
WHERE jobname IN ('ntf-outbox-processor', 'ntf-outbox-retry')
ORDER BY start_time DESC
LIMIT 10;
```

Expected: `status = succeeded` for recent runs.

If all runs show `status = failed`:
1. Check `return_message` — likely contains a `401` or network error
2. Verify `app.next_js_base_url` and `app.outbox_secret_key` GUCs
3. Ensure `NOTIFICATIONS_OUTBOX_SECRET` env var matches the GUC

---

## Test the Stale Push Sweep

```sql
-- Run the sweep function directly (safe on a fresh install — returns 0)
SELECT ntf_sweep_stale_push_subs();
-- Expected: (0) — no stale subscriptions on a fresh install

-- Simulate a stale subscription to test sweep logic
UPDATE org_notif_push_subs_dtl
SET last_verified_at = NOW() - INTERVAL '91 days'
WHERE id = '<subscription_id>';

-- Run sweep again
SELECT ntf_sweep_stale_push_subs();
-- Expected: (1) — the simulated stale subscription is now deactivated

-- Verify
SELECT is_active, rec_notes FROM org_notif_push_subs_dtl WHERE id = '<subscription_id>';
-- is_active should be false
```

---

## Full System Smoke Test (all channels in sequence)

Run after initial setup to confirm everything works end-to-end:

- [ ] IN_APP: insert inbox row → see bell increment → mark as read
- [ ] EMAIL: insert outbox row → trigger processor → check inbox + delivery log → email received
- [ ] SMS: insert outbox row → trigger processor → check delivery log → SMS received
- [ ] WHATSAPP: insert outbox row → trigger processor → check delivery log → WA message received
- [ ] PUSH: verify subscription registered → insert outbox row → trigger processor → notification received
- [ ] pg_cron: check `cron.job_run_details` for `succeeded` status on all 3 ntf jobs
- [ ] Stale sweep: run `SELECT ntf_sweep_stale_push_subs()` → returns 0 on fresh install
