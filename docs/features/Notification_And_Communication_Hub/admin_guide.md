# CMX-PRD-019 — Notification Hub: Admin Guide

**Last Updated:** 2026-06-12  
**Audience:** Tenant admins (super_admin, tenant_admin, admin roles)  
**Status:** Phases 1–4 complete (cleanmatex MVP)

---

## Overview

As an admin you control which notification channels are active, which providers handle delivery, quiet hours for your tenant, and which users have what preferences. This guide covers all admin-level configuration.

---

## 1. Accessing Admin Settings

Navigate to: **Notifications → Channel Settings**  
Route: `/dashboard/notifications/settings` (Channel Settings tab)

Requires role: `admin`, `tenant_admin`, or `super_admin`  
Permission: `notifications:configure`

If you don't see the "Channel Settings" tab, your account does not have the `notifications:configure` permission. Contact your system administrator.

---

## 2. Channel Enable / Disable

Each notification channel can be independently enabled or disabled at the tenant level.

### Available Channels

| Channel | Description | Provider |
|---------|-------------|----------|
| IN_APP | Notifications inside the web admin | Supabase Realtime (built-in) |
| EMAIL | Email to user account address | Resend |
| SMS | Text message to phone number | Twilio |
| WHATSAPP | WhatsApp message | Twilio or Meta Cloud |
| PUSH | Browser/device push notification | VAPID / FCM / OneSignal |

### Enable a Channel

1. Go to **Channel Settings** tab
2. Find the channel card
3. Toggle the switch to ON

When a channel is disabled, all new notifications for that channel are skipped (outbox rows are written with `status = SKIPPED, skip_reason = CHANNEL_DISABLED`). Existing queued rows are not affected.

### Disable a Channel

Toggle the switch to OFF. No active outbox rows are cancelled — they will continue processing. Only new notifications will be skipped.

---

## 3. Quiet Hours Configuration

Quiet hours prevent non-urgent notifications from being sent during off-hours (e.g., at night).

### Enable Quiet Hours for a Channel

1. Enable the channel first (if not already)
2. Toggle **Quiet Hours** switch to ON
3. Set **Quiet Hours Start** (e.g., 22:00)
4. Set **Quiet Hours End** (e.g., 08:00)

> Times are evaluated in the tenant's default timezone (configured in tenant settings). If no timezone is set, UTC is used.

### Overnight Windows

Quiet hours can span midnight. Example: 22:00 to 08:00 = active from 10 PM to 8 AM the following day.

### Priority Bypass

URGENT and CRITICAL priority notifications always bypass quiet hours regardless of configuration. Standard business notifications (priority: NORMAL, HIGH) respect quiet hours.

### How Notifications Are Handled During Quiet Hours

Non-urgent notifications sent during quiet hours are **scheduled** to be delivered when quiet hours end — they are not lost. The outbox processor picks them up automatically at the quiet-hours-end time.

---

## 4. Provider Configuration

Providers are the third-party services that actually deliver notifications. Each channel has exactly one active provider at a time.

**Route:** Managed via API at `/api/v1/notifications/settings/providers`  
**Requires:** `notifications:configure`

> There is no dedicated provider configuration UI page in the current release (Phase 3). Admins configure providers via the Setup SQL scripts or directly via API.

### View Active Provider

```sql
SELECT channel_code, provider_code, is_active, is_enabled, config, updated_at
FROM org_ntf_channel_provider_cf
WHERE tenant_org_id = 'your-tenant-uuid'
ORDER BY channel_code;
```

### Activate a Provider

Only one provider can be active per channel. Activating a new provider automatically deactivates all others for that channel.

```http
PUT /api/v1/notifications/settings/providers
Authorization: Bearer <your-session-token>
Content-Type: application/json

{
  "channel_code": "EMAIL",
  "provider_code": "RESEND",
  "action": "activate"
}
```

### Provider Status Reference

| Provider | Channel | Status | Notes |
|----------|---------|--------|-------|
| SUPABASE_REALTIME | IN_APP | ✅ Active | Built-in, always on |
| RESEND | EMAIL | ✅ Active | Requires `RESEND_API_KEY` env var |
| TWILIO_SMS | SMS | ⏸ Inactive | Requires Twilio credentials |
| TWILIO_WHATSAPP | WHATSAPP | ⏸ Inactive | Requires META template approval |
| META_WHATSAPP | WHATSAPP | ⏸ Inactive | Direct Meta Cloud API alternative |
| VAPID | PUSH | ⏸ Inactive | Requires VAPID keys + sw.js deployed |
| FCM | PUSH | ⏸ Inactive | Requires Firebase service account |
| ONESIGNAL | PUSH | ⏸ Inactive | Requires OneSignal app credentials |

---

## 5. User Preferences Management

Individual user preferences override tenant defaults per channel.

### View a User's Preferences

```sql
SELECT channel_code, event_code, is_enabled, marketing_consent, consent_given_at
FROM org_notif_user_prefs_dtl
WHERE tenant_org_id = 'your-tenant-uuid'
  AND user_id = 'target-user-uuid'
ORDER BY channel_code, event_code;
```

### Override a User's Channel Preference (admin)

```sql
-- Disable EMAIL for a specific user (e.g., bounced email address)
INSERT INTO org_notif_user_prefs_dtl (
  id, tenant_org_id, user_id, channel_code, event_code,
  is_enabled, marketing_consent, rec_status, created_at, created_by
) VALUES (
  gen_random_uuid(),
  'your-tenant-uuid',
  'target-user-uuid',
  'EMAIL',
  NULL,  -- NULL event_code = applies to all events on this channel
  false,
  false,
  1,
  NOW(),
  'admin-override'
) ON CONFLICT (tenant_org_id, user_id, channel_code, event_code)
  WHERE event_code IS NULL
  DO UPDATE SET is_enabled = false, updated_at = NOW(), updated_by = 'admin-override';
```

---

## 6. Marketing Consent Management

Marketing consent is required before sending any non-transactional notification (event flag `is_transactional = false`). This applies to promotions, campaigns, and marketing events.

**How it works:**
- Users set their own consent via the Settings page (My Preferences tab → Marketing Consent toggle per channel)
- If consent is `false` or missing, the orchestrator writes an outbox row with `status = SKIPPED, skip_reason = NO_MARKETING_CONSENT`
- This is enforced in `orchestrator.ts` before any external channel dispatch

**GDPR/compliance note:** Never override consent to `true` via admin SQL without explicit user consent on record. The `consent_given_at` and `consent_ip` fields should be set only when the user themselves provides consent through the UI.

---

## 7. Push Subscription Management

Push subscriptions can accumulate stale entries as users change browsers or uninstall apps.

### View Active Subscriptions

```sql
SELECT user_id, provider_code, platform, last_verified_at, failure_count, is_active
FROM org_ntf_push_subs_dtl
WHERE tenant_org_id = 'your-tenant-uuid'
  AND is_active = true
ORDER BY last_verified_at DESC;
```

### Force-Deactivate a Subscription (e.g., user complaint)

```sql
UPDATE org_ntf_push_subs_dtl
SET is_active = false, updated_at = NOW(), updated_by = 'admin-deactivate',
    rec_notes = 'Manually deactivated by admin on 2026-06-12'
WHERE id = 'subscription-uuid';
```

### Automated Stale Sweep

The `ntf_sweep_stale_push_subs()` function runs every Sunday at 03:00 UTC and deactivates:
- Subscriptions with `failure_count > 3`
- Subscriptions not verified in the last 90 days

Trigger manually if needed:
```sql
SELECT ntf_sweep_stale_push_subs();
-- Returns: count of subscriptions deactivated
```

---

## 8. Delivery Log Review

Access at: `/dashboard/notifications/delivery-log`  
Requires: `notifications:view_log` permission

The delivery log shows real delivery outcomes per outbox row. Use it to:
- Diagnose delivery failures
- Verify notifications were sent
- Identify permanent failures (invalid email/phone)

### Common Failure Patterns

| Error | Channel | Likely Cause | Resolution |
|-------|---------|--------------|-----------|
| Authentication required | EMAIL | Invalid RESEND_API_KEY | Rotate API key, update env var |
| invalid_number (code 21211) | SMS | Phone not in E.164 format | Correct phone number in user profile |
| NotRegistered | PUSH | Stale VAPID subscription | User should re-enable push, sweep removes it |
| Template not approved | WHATSAPP | META template pending | Wait for approval or use free-form (24hr window) |
| QUOTA_EXCEEDED | any | Tenant over plan limit | Upgrade plan or contact platform support |

### Investigating a Specific Notification

```sql
-- Find outbox row for a notification
SELECT o.id, o.channel_code, o.status, o.error_message, o.retry_count, o.sent_at
FROM org_notification_outbox_dtl o
WHERE o.tenant_org_id = 'your-tenant-uuid'
  AND o.event_code = 'order.ready'
ORDER BY o.created_at DESC
LIMIT 10;

-- View all delivery attempts for that outbox row
SELECT dl.status, dl.attempt_number, dl.error_message, dl.duration_ms, dl.logged_at
FROM org_notif_delivery_log_dtl dl
WHERE dl.outbox_id = 'outbox-row-uuid'
ORDER BY dl.attempt_number;
```

---

## 9. Monitoring pg_cron Jobs

All notification cron jobs should show `status = succeeded`:

```sql
SELECT jobname, status, return_message, start_time, end_time
FROM cron.job_run_details
WHERE jobname LIKE 'ntf%'
ORDER BY start_time DESC
LIMIT 15;
```

### If jobs are failing

**Check `return_message`:**
- `401 Unauthorized` → `outbox_secret_key` in `sys_ntf_runtime_cf` does not match `NOTIFICATIONS_OUTBOX_SECRET` env var
- Network error / timeout → `next_js_base_url` in `sys_ntf_runtime_cf` is incorrect or app is down
- SQL error → check the function definition of `ntf_trigger_outbox_proc()`

**Update runtime config:**
```sql
UPDATE sys_ntf_runtime_cf SET value = 'https://correct-domain.com', updated_at = NOW()
WHERE key = 'next_js_base_url';
```

---

## 10. Campaign Management (Phase 4)

Campaigns are bulk notification broadcasts targeted at specific customer segments. Only available when the `campaigns_enabled` feature flag is ON.

### Campaign Approval Workflow

1. A user with `notifications:manage` creates a DRAFT campaign
2. They click **Submit for Approval** → status moves to PENDING_APPROVAL
3. An admin clicks **Approve** → status moves to APPROVED
4. Either: admin clicks **Launch** (immediate), or the pg_cron job activates it when `scheduled_at <= NOW()` (SCHEDULED)
5. The campaign processor runs targets in batches every minute
6. When all targets are processed → COMPLETED

### Monitoring Running Campaigns

```sql
-- View all RUNNING campaigns and their progress
SELECT id, name, channel_code, total_targets_count, sent_count, skip_count, failed_count, started_at
FROM org_ntf_campaigns_mst
WHERE tenant_org_id = 'your-tenant-uuid'
  AND status = 'RUNNING'
ORDER BY started_at DESC;
```

### View Campaign Targets

```sql
-- Campaign dispatch status breakdown
SELECT status, skip_reason, COUNT(*) as count
FROM org_ntf_camp_targets_dtl
WHERE campaign_id = 'campaign-uuid'
GROUP BY status, skip_reason
ORDER BY status;
```

### Cancelling a Stuck Campaign

If a campaign gets stuck in RUNNING (e.g., processor crashed mid-run):

```sql
-- Via API (preferred)
PATCH /api/v1/notifications/campaigns/<id>/status
{ "status": "CANCELLED", "reason": "Manual admin cancel — processor stall" }
```

Or directly:
```sql
UPDATE org_ntf_campaigns_mst
SET status = 'CANCELLED', cancelled_at = NOW(), updated_at = NOW(), updated_by = 'admin-override'
WHERE id = 'campaign-uuid' AND tenant_org_id = 'your-tenant-uuid';
```

---

## 11. Notification Volume / Capacity

There are currently no per-tenant notification quotas enforced (quota API is planned in cleanmatexsaas — Phase A). Monitor delivery volume manually:

```sql
-- Today's outbox volume by channel
SELECT channel_code, status, COUNT(*) as count
FROM org_notification_outbox_dtl
WHERE tenant_org_id = 'your-tenant-uuid'
  AND created_at >= CURRENT_DATE
GROUP BY channel_code, status
ORDER BY channel_code, status;
```

---

## 11. Archiving Old Notifications

Currently no automatic archiving is configured. Old inbox notifications accumulate in `org_notifications_mst`. Plan to run periodic cleanup:

```sql
-- Archive read notifications older than 90 days (safe — soft delete only)
UPDATE org_notifications_mst
SET rec_status = 0, is_active = false, updated_at = NOW(), updated_by = 'archive-job'
WHERE tenant_org_id = 'your-tenant-uuid'
  AND is_read = true
  AND created_at < NOW() - INTERVAL '90 days'
  AND rec_status = 1;
```

> A pg_cron-based archiving job is planned as a follow-up after Phase 4.
