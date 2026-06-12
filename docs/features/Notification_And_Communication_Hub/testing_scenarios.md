# CMX-PRD-019 — Notification Hub: Testing Scenarios

**Last Updated:** 2026-06-12  
**Audience:** QA engineers, developers, admins  
**Status:** Covers Phases 1–3 + Frontend Track A

See also: `Setup_And_Config/11_smoke_tests.md` for SQL-level smoke test harness.

---

## 1. Unit Test Coverage Areas

### Event Emitter (`lib/notifications/event-emitter.ts`)
- [ ] `emitNotificationEvent()` resolves without throwing even when orchestrator throws
- [ ] Error is logged, not rethrown (fire-and-forget contract)
- [ ] Called with minimal valid payload → no runtime errors

### Orchestrator (`lib/notifications/orchestrator.ts`)
- [ ] Disabled channel → outbox row skipped
- [ ] Quiet hours active → `scheduled_at` set to quiet-hours-end time
- [ ] Quiet hours + URGENT priority → `scheduled_at = NOW()` (bypass)
- [ ] Non-transactional event + no consent → outbox row with `status = SKIPPED, skip_reason = NO_MARKETING_CONSENT`
- [ ] Duplicate idempotency key → second write silently ignored (ON CONFLICT DO NOTHING)
- [ ] IN_APP → writes to `org_notifications_mst` (not outbox)
- [ ] EMAIL → writes to `org_notification_outbox_dtl` with `channel_code = 'EMAIL'`

### Quiet Hours (`computeScheduledAt()`)
- [ ] Time before quiet hours → returns NOW()
- [ ] Time inside quiet hours (same day) → returns quiet-hours-end timestamp today
- [ ] Time inside quiet hours (overnight, past midnight) → returns quiet-hours-end timestamp next day
- [ ] CRITICAL priority during quiet hours → returns NOW()
- [ ] URGENT priority during quiet hours → returns NOW()

### NotificationSettingsService (`lib/notifications/settings-service.ts`)
- [ ] Cache hit path: second call within 30s returns cached value (no DB query)
- [ ] Cache miss path: after 30s, re-queries DB
- [ ] `invalidateChannel()` clears tenant cache
- [ ] `invalidateUserPrefs()` clears user-specific cache
- [ ] `hasMarketingConsent()` returns false when no pref row exists (safe default)
- [ ] `getActiveProvider()` returns null when no active provider

### Push Subscription Management
- [ ] Upsert on `(tenant_org_id, user_id, device_id, provider_code)` — same device = update, not duplicate
- [ ] `is_active = false` set when `failure_count > 3`
- [ ] `is_active = false` set on 410 Gone (VAPID) or `NotRegistered` (FCM) response

### Outbox Processor
- [ ] Only processes `status IN ('QUEUED', 'FAILED_TEMPORARY')`
- [ ] Sets status to `PROCESSING` before calling adapter
- [ ] On adapter success → status = `SENT`, delivery log row written
- [ ] On permanent adapter error → status = `FAILED_PERMANENT`
- [ ] On transient error → status = `FAILED_TEMPORARY`, `retry_count++`, `next_retry_at` set
- [ ] `retry_count >= max_retries` → status = `FAILED_PERMANENT` (no more retries)

---

## 2. Integration Test Checklist

Run against local Supabase instance with all migrations applied.

### IN_APP Channel

- [ ] Create an order as a non-admin user
- [ ] Verify `org_notifications_mst` has a new row with `recipient_user_id` = order creator
- [ ] Verify `is_read = false`
- [ ] Verify `channel_code = 'IN_APP'`
- [ ] Verify Realtime event arrives on the client subscription within 2 seconds
- [ ] Mark notification as read via API → `is_read = true`
- [ ] Mark all read → all rows for user have `is_read = true`

### EMAIL Channel

- [ ] Enable EMAIL channel in tenant settings
- [ ] Activate RESEND provider
- [ ] Trigger an order.created event via API
- [ ] Verify outbox row created with `channel_code = 'EMAIL'`, `status = 'QUEUED'`
- [ ] Call `POST /api/notifications/process-outbox` with correct secret
- [ ] Verify outbox row updated to `status = 'SENT'`
- [ ] Verify delivery log row created

### SMS Channel

- [ ] Enable SMS channel + activate TWILIO_SMS provider
- [ ] Set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_SMS_FROM` env vars
- [ ] Insert outbox row with `channel_code = 'SMS', recipient_address = '+E164_number'`
- [ ] Trigger processor
- [ ] Verify SMS received on test phone
- [ ] Verify outbox status = `SENT`

### PUSH Channel (VAPID)

- [ ] VAPID keys set in env
- [ ] sw.js served at `/sw.js`
- [ ] Browser granted notification permission
- [ ] User subscribed via `POST /api/notifications/push-subscription`
- [ ] Verify `org_notif_push_subs_dtl` row created with `provider_code = 'VAPID', is_active = true`
- [ ] Insert outbox row with `channel_code = 'PUSH', recipient_user_id = user.id`
- [ ] Trigger processor
- [ ] Verify browser push notification appears
- [ ] Verify outbox status = `SENT`

---

## 3. Multi-Tenant Isolation Tests (Critical)

**Security requirement:** Users must never see notifications from other tenants.

### Test: Realtime Isolation

1. Create two tenants: Tenant A and Tenant B
2. Subscribe Tenant A's user to Realtime on `org_notifications_mst`
3. Insert a notification for Tenant B's user
4. Verify Tenant A's client does NOT receive a Realtime event

```sql
-- RLS policy should prevent cross-tenant reads
-- Test as anon role with Tenant A's JWT:
SET request.jwt.claims TO '{"sub": "user-a-id", "tenant_org_id": "tenant-a-uuid"}';
SELECT * FROM org_notifications_mst WHERE tenant_org_id = 'tenant-b-uuid';
-- Expected: 0 rows (RLS blocks it)
```

### Test: API Isolation

- Make a `GET /api/v1/notifications` request as Tenant A's user
- Verify response only contains `tenant_org_id = tenant-a-uuid` rows
- Attempt to `PATCH /api/v1/notifications/{tenant-b-notification-id}/read` → expect 404 or 403

### Test: Delivery Log Isolation

- `GET /api/v1/notifications/delivery-log` as Tenant A admin
- Verify no Tenant B records appear

---

## 4. Frontend QA Test Scenarios

### Bell UI

| Scenario | Expected |
|----------|---------|
| New notification arrives | Badge count increments in real-time (no refresh) |
| Click bell | Dropdown opens showing last 20 notifications |
| Press Escape | Dropdown closes |
| Click outside dropdown | Dropdown closes |
| Click notification | Notification marked read; badge count decrements |
| "Mark all read" button | All notifications marked read; badge becomes 0 |
| "View all" link | Navigates to `/dashboard/notifications` |
| RTL locale (Arabic) | Bell and dropdown render correctly in RTL layout |
| 0 unread | No badge displayed (badge only appears when count > 0) |
| 1 unread | Badge shows "1" |
| 99+ unread | Badge shows "99+" (or truncated) |

### Notification Center Page

| Scenario | Expected |
|----------|---------|
| All tab selected | Shows all notifications regardless of is_read |
| Unread tab | Only `is_read = false` rows |
| Orders tab | Only `category_code = 'ORDER'` rows |
| Payments tab | Only `category_code = 'PAYMENT'` rows |
| System tab | Only `category_code = 'SYSTEM'` rows |
| Mark as read (item) | Row background changes; unread dot disappears |
| Mark all read | All rows update; bell count resets |
| Empty tab | Shows "No notifications" empty state |
| Pagination | Page 2 loads next 20 items |
| RTL | All elements mirror correctly in Arabic mode |

### Notification Settings Page

| Scenario | Expected |
|----------|---------|
| Non-admin user | Only "My Preferences" tab visible |
| Admin user | Both tabs visible |
| Toggle channel off | Switch updates; preference saved |
| Toggle marketing consent | Saves immediately |
| Toggle quiet hours (admin) | Quiet hours time inputs appear |
| Set quiet hours start/end | Values saved on blur |
| API error | Error message displayed in CmxSummaryMessage |

### Delivery Log Page

| Scenario | Expected |
|----------|---------|
| Initial load | Shows latest 20 delivery entries |
| Channel filter | Only selected channel rows shown |
| Status filter | Only selected status rows shown |
| Both filters | Intersection applied |
| Refresh button | Reloads data; loading spinner shows while fetching |
| Empty result | "No delivery records" empty message |

---

## 5. Quiet Hours Test Scenarios

| Test | Setup | Expected Behavior |
|------|-------|------------------|
| Normal notification during quiet hours | Quiet hours: 22:00–08:00; current time: 23:30 | outbox row `scheduled_at = tomorrow 08:00` |
| URGENT notification during quiet hours | Same setup; event priority = URGENT | outbox row `scheduled_at = NOW()` |
| CRITICAL notification during quiet hours | Same setup; event priority = CRITICAL | outbox row `scheduled_at = NOW()` |
| Quiet hours disabled | quiet_hours_enabled = false | `scheduled_at = NOW()` regardless of time |
| Overnight quiet hours near midnight | Quiet hours: 22:00–08:00; current time: 00:30 | `scheduled_at = today 08:00` |

---

## 6. Marketing Consent Test Scenarios

| Test | Setup | Expected Behavior |
|------|-------|------------------|
| Transactional event, no consent | `is_transactional = true`; user has no consent | outbox row written and dispatched normally |
| Marketing event, consent given | `is_transactional = false`; `marketing_consent = true` | outbox row written and dispatched |
| Marketing event, no consent | `is_transactional = false`; `marketing_consent = false` | outbox `status = SKIPPED`, `skip_reason = NO_MARKETING_CONSENT` |
| Marketing event, consent missing (no pref row) | No row in `org_notif_user_prefs_dtl` | Same as "no consent" — blocked |

---

## 7. Retry Logic Test Scenarios

| Scenario | Expected |
|----------|---------|
| Adapter returns transient error (5xx) | `status = FAILED_TEMPORARY`, `retry_count = 1`, `next_retry_at = NOW() + 60s` |
| Second retry fails | `retry_count = 2`, `next_retry_at = NOW() + 120s` |
| Fifth retry fails (`retry_count = max_retries`) | `status = FAILED_PERMANENT` — no more retries |
| Adapter returns permanent error (4xx, invalid address) | Immediately `status = FAILED_PERMANENT` |
| Processor called twice on same QUEUED row (concurrent) | Second call finds `PROCESSING` status and skips it |

---

## 8. Stale Push Sweep Test

```sql
-- 1. Simulate stale subscription (90+ days old)
UPDATE org_notif_push_subs_dtl
SET last_verified_at = NOW() - INTERVAL '91 days'
WHERE id = 'test-subscription-uuid';

-- 2. Simulate high failure count
UPDATE org_notif_push_subs_dtl
SET failure_count = 4
WHERE id = 'test-subscription-uuid-2';

-- 3. Run sweep
SELECT ntf_sweep_stale_push_subs();
-- Expected: 2 (or count of matching subscriptions)

-- 4. Verify both are deactivated
SELECT id, is_active, failure_count, last_verified_at
FROM org_notif_push_subs_dtl
WHERE id IN ('test-subscription-uuid', 'test-subscription-uuid-2');
-- Both should have is_active = false
```

---

## 9. Build & i18n Validation (must pass before every release)

```bash
cd web-admin

# Type check
npx tsc --noEmit

# i18n key consistency (all keys in en.json must exist in ar.json)
npm run check:i18n

# Full production build (catches import errors, missing env vars, etc.)
npm run build
```

Expected: Zero errors and zero warnings for all three commands.

---

## 10. QA Sign-off Checklist (per release)

- [ ] All unit tests pass: `npm test` (or Jest run for notifications)
- [ ] Build passes: `npm run build`
- [ ] i18n check: `npm run check:i18n`
- [ ] IN_APP real-time: bell badge increments on new notification (no page refresh)
- [ ] EMAIL smoke test: email received in inbox
- [ ] Delivery log shows SENT for email
- [ ] Mark as read: single + mark all
- [ ] Notification Center: all 5 tabs working
- [ ] Settings page: preference toggle saves correctly
- [ ] Admin channel settings: quiet hours, enable/disable
- [ ] RTL layout: notification bell, center, settings all correct in Arabic
- [ ] Multi-tenant: no cross-tenant data visible
- [ ] pg_cron: all 3 ntf jobs showing `succeeded` status
