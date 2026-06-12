# CMX-PRD-019 — Notification Hub: Developer Guide

**Last Updated:** 2026-06-12  
**Audience:** Backend and full-stack developers working on CleanMateX  
**Status:** Phases 1–3 + Frontend Track A complete | Next: Phase 4 Campaign Engine

---

## 1. Architecture Overview

```
Business Event (order status change, payment received, etc.)
        │
        ▼
emitNotificationEvent()     ← Fire-and-forget; never throws to caller
lib/notifications/event-emitter.ts
        │
        ▼
orchestrateNotification()   ← Resolve recipients, enforce rules, route
lib/notifications/orchestrator.ts
        │
        ├── IN_APP  ──────► org_notifications_mst (direct insert)
        │                       └─► Supabase Realtime ──► Bell UI (instant)
        │
        └── EMAIL / SMS / WHATSAPP / PUSH
                    │
                    ▼
          org_notification_outbox_dtl (queued)
                    │
                    ▼
          pg_cron (every 1 min) → pg_net → POST /api/notifications/process-outbox
                    │
                    ├── EmailAdapter (Resend)
                    ├── SmsAdapter (Twilio)
                    ├── WhatsAppAdapter (factory: Twilio BSP or Meta Cloud)
                    └── PushAdapter (factory: VAPID / FCM / OneSignal)
                              │
                              ▼
                    org_notif_delivery_log_dtl (immutable audit trail)
```

**Design principles:**
- Business code calls `emitNotificationEvent()` only — never adapters directly
- `emitNotificationEvent()` is fire-and-forget: errors are logged, never thrown
- IN_APP is synchronous (direct insert); all external channels are async (outbox)
- Every outbox row has a unique `idempotency_key` — duplicate events are silently ignored
- Failed external sends retry automatically (up to 5 attempts, exponential backoff)

---

## 2. Key Files Reference

### Core Library (`web-admin/lib/notifications/`)

| File | Purpose |
|------|---------|
| `event-emitter.ts` | `emitNotificationEvent()` — the single entry point for all business code |
| `orchestrator.ts` | Core routing: resolve recipients → enforce rules → dispatch to adapters |
| `settings-service.ts` | Singleton with 30s cache for channel configs and user prefs |
| `types.ts` | TypeScript types (NotificationEvent, NotificationChannel, NotificationPriority, etc.) |
| `recipient-resolver.ts` | Maps event_code → recipient user IDs |

### Adapters (`web-admin/lib/notifications/adapters/`)

| File | Purpose |
|------|---------|
| `in-app.ts` | Writes to `org_notifications_mst`; handles idempotency key |
| `outbox.ts` | Writes to `org_notification_outbox_dtl` for external channels |
| `email.ts` | Resend API integration |
| `sms.ts` | Twilio Programmable Messaging |
| `whatsapp.ts` | Factory: TWILIO_WHATSAPP or META_WHATSAPP, selected per tenant |
| `push.ts` | Factory: reads active provider, fans out to all active user subscriptions |
| `push/vapid.ts` | W3C Web Push (VAPID) via `web-push` npm package |
| `push/fcm.ts` | FCM v1 HTTP API with JWT service account (no Firebase SDK) |
| `push/onesignal.ts` | OneSignal REST API |

### API Routes (`web-admin/app/api/`)

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/v1/notifications` | GET | Paginated notification inbox (current user) |
| `/api/v1/notifications/unread-count` | GET | Unread count (30s cache) |
| `/api/v1/notifications/[id]/read` | PATCH | Mark single notification read |
| `/api/v1/notifications/read-all` | PATCH | Mark all as read (current user) |
| `/api/v1/notifications/user-prefs` | GET, PUT | User preference management |
| `/api/v1/notifications/settings` | GET, PUT | Tenant channel settings (admin) |
| `/api/v1/notifications/settings/providers` | GET, POST, PUT, DELETE | Provider config (admin) |
| `/api/v1/notifications/delivery-log` | GET | Delivery log (admin) |
| `/api/notifications/process-outbox` | POST | Internal: called by pg_cron |
| `/api/notifications/push-subscription` | POST, DELETE | Push subscription management |

### UI Components (`web-admin/src/features/notifications/ui/`)

| File | Purpose |
|------|---------|
| `notification-bell.tsx` | Bell icon + badge + dropdown (wired into app header) |
| `notification-item.tsx` | Single notification row (reusable across bell and center) |
| `notification-center-page.tsx` | Full-page notification center with tabs |
| `notification-settings-page.tsx` | Channel preferences + admin channel settings |
| `delivery-log-page.tsx` | Delivery log table (admin) |

---

## 3. How to Add a New Notification Event

### Step 1: Register the event in the catalog seed

Add a row to `sys_notification_events_cd` in a new migration (or include in the next batch migration):

```sql
INSERT INTO sys_notification_events_cd (
  event_code, category_code, name, name2,
  priority, is_transactional, requires_consent,
  default_channels, idempotency_key_pattern,
  is_active, rec_status
) VALUES (
  'order.expired',
  'ORDER',
  'Order Expired',
  'انتهت صلاحية الطلب',
  'NORMAL',
  true,    -- is_transactional: no consent check needed
  false,
  ARRAY['IN_APP', 'EMAIL'],
  'order_expired_{order_id}_{tenant_org_id}',
  true, 1
) ON CONFLICT (event_code) DO UPDATE SET
  name = EXCLUDED.name,
  name2 = EXCLUDED.name2,
  updated_at = CURRENT_TIMESTAMP;
```

### Step 2: Add translations (if the event name appears in UI)

In `web-admin/messages/en.json` and `ar.json`, if the event name needs to appear in the delivery log or elsewhere.

### Step 3: Emit the event from business code

Find the server action or API route where the business event occurs (e.g., order status change):

```typescript
import { emitNotificationEvent } from '@lib/notifications/event-emitter'

// After order expires
void emitNotificationEvent({
  code: 'order.expired',
  tenantOrgId: tenantId,
  recipientUserIds: [orderCreatorId, branchManagerId],
  sourceEntityType: 'order',
  sourceEntityId: order.id,
  variables: {
    order_number: order.orderNo,
    expired_at: new Date().toISOString(),
  },
})
```

**Rules:**
- Always use `void` — fire-and-forget, never `await`
- Never `try/catch` around it — the emitter handles its own error logging
- `recipientUserIds` comes from your business logic (who should know about this event)
- `variables` map to template placeholders: `{order_number}` in templates becomes the value

### Step 4: Update recipient resolver (if needed)

If the new event has a standard recipient pattern (not caller-supplied), add it to `lib/notifications/recipient-resolver.ts`:

```typescript
case 'order.expired':
  return resolveOrderStaff(tenantOrgId, sourceEntityId)
```

### Step 5: Add a template (optional for Phase 1; required for email/SMS/WA)

Insert into `sys_notification_templates_mst` and `sys_notif_template_ver_dtl` for the new event. For now, the email adapter renders the `body` field directly — templates are used when the tenant has a custom template configured.

---

## 4. Orchestrator Rules (enforced automatically)

The orchestrator (`lib/notifications/orchestrator.ts`) enforces these rules in order:

1. **Channel enabled check** — `NotificationSettingsService.isChannelEnabled(tenantOrgId, channel)` — if disabled, skip
2. **Quiet hours** — `computeScheduledAt()` — if current time is within tenant's quiet window AND priority < URGENT, set `scheduled_at` to quiet-hours-end time instead of NOW
3. **Marketing consent** — if `sys_notification_events_cd.is_transactional = false`, call `hasMarketingConsent(tenantOrgId, userId, channel)` — if false, write outbox row with status=SKIPPED, skip_reason='NO_MARKETING_CONSENT'
4. **Idempotency** — `ON CONFLICT (idempotency_key) DO NOTHING` on both inbox and outbox inserts

You do **not** need to implement these rules in calling code — the orchestrator handles all of them.

---

## 5. NotificationSettingsService

Singleton with 30-second in-memory cache. All reads go through this service — never query `org_notification_settings_cf` or `org_ntf_channel_provider_cf` directly in business code.

```typescript
import { notificationSettingsService } from '@lib/notifications/settings-service'

// Check if a channel is enabled for a tenant
const enabled = await notificationSettingsService.isChannelEnabled(tenantOrgId, 'EMAIL')

// Get active provider for a channel
const provider = await notificationSettingsService.getActiveProvider(tenantOrgId, 'PUSH')
// Returns: { providerCode: 'VAPID', config: {...} } | null

// Check user's marketing consent for a channel
const consent = await notificationSettingsService.hasMarketingConsent(tenantOrgId, userId, 'EMAIL')

// Invalidate cache (call after settings changes)
notificationSettingsService.invalidateChannel(tenantOrgId)
notificationSettingsService.invalidateUserPrefs(tenantOrgId, userId)
```

**Always call** `invalidateChannel(tenantOrgId)` after any PUT to channel settings or provider config routes. The settings routes already do this automatically.

---

## 6. Database Schema (Key Tables)

### Global Catalog (no tenant isolation)

| Table | Purpose |
|-------|---------|
| `sys_notif_categories_cd` | 27 notification categories (ORDER, PAYMENT, SYSTEM, …) |
| `sys_notification_events_cd` | 116+ event definitions with priority, consent flags, default channels |
| `sys_ntf_providers_cd` | Provider catalog (RESEND, VAPID, ONESIGNAL, TWILIO_SMS, …) |
| `sys_notification_templates_mst` | Template definitions (bilingual) |
| `sys_notif_template_ver_dtl` | Template versions (DRAFT/APPROVED/RETIRED) |
| `sys_ntf_runtime_cf` | Key/value runtime config (next_js_base_url, outbox_secret_key) |

### Tenant Runtime (all have tenant_org_id + RLS)

| Table | Purpose |
|-------|---------|
| `org_notifications_mst` | User notification inbox (IN_APP messages) |
| `org_notification_outbox_dtl` | External channel dispatch queue |
| `org_notif_delivery_log_dtl` | Immutable delivery audit trail |
| `org_notification_settings_cf` | Tenant channel settings (quiet hours, enabled flag) |
| `org_notif_user_prefs_dtl` | Per-user per-channel preferences and marketing consent |
| `org_notif_push_subs_dtl` | Push subscription registry (VAPID/FCM/OneSignal) |
| `org_ntf_channel_provider_cf` | Per-tenant active provider per channel |

---

## 7. Realtime Subscription (Bell UI)

The notification bell subscribes to Supabase Realtime on `org_notifications_mst`:

```typescript
const channel = supabase
  .channel(`notifications:${tenantOrgId}:${userId}`)
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'org_notifications_mst',
      filter: `recipient_user_id=eq.${userId}`,
    },
    (payload) => {
      // New notification row arrived
      setUnreadCount(prev => prev + 1)
      setRecentNotifications(prev => [payload.new, ...prev].slice(0, 20))
    }
  )
  .subscribe()
```

**Realtime is enabled** on `org_notifications_mst` via `REPLICA IDENTITY FULL` + `ALTER PUBLICATION supabase_realtime ADD TABLE org_notifications_mst` (migration 0348).

RLS on `org_notifications_mst` ensures each user only receives their own notifications from Realtime.

---

## 8. Outbox Processor

`POST /api/notifications/process-outbox` — secured with `NOTIFICATIONS_OUTBOX_SECRET` bearer token.

**Called by:** Supabase pg_cron via `ntf_trigger_outbox_proc()` SECURITY DEFINER function (reads base_url + secret from `sys_ntf_runtime_cf`).

**Logic:**
1. Fetch up to 50 QUEUED rows where `scheduled_at <= NOW()`
2. Also fetch FAILED_TEMPORARY rows where `next_retry_at <= NOW() AND retry_count < max_retries`
3. For each row: mark PROCESSING → dispatch via channel adapter → update status
4. Write delivery log entry for each attempt

**Retry backoff:** `next_retry_at = NOW() + (2^retry_count * 60 seconds)`  
**Max retries:** 5 (configurable per row via `max_retries` column)

---

## 9. Push Subscription Lifecycle

1. **Register:** after user grants browser permission → `POST /api/notifications/push-subscription` with `{ deviceId, providerCode: 'VAPID', subscriptionData: {...} }`
2. **Refresh:** same endpoint with `PUT` behavior (upsert on `device_id + provider_code`)
3. **Send:** `PushAdapter` fans out to all active subscriptions for the recipient user
4. **Permanent failure:** 410 Gone (VAPID) or `NotRegistered` (FCM) → marks subscription `is_active = false`
5. **Failure accumulation:** after 3+ failures, subscription deactivated permanently
6. **Weekly sweep:** `ntf_sweep_stale_push_subs()` pg_cron (Sunday 03:00 UTC) deactivates subscriptions with `failure_count > 3` or `last_verified_at < NOW() - 90 days`

---

## 10. Idempotency Key Pattern

Every notification has a unique `idempotency_key` to prevent duplicate delivery from retried business logic:

**Format:** `{event_code}_{source_entity_id}_{tenant_org_id}_{timestamp_bucket}`

The `timestamp_bucket` is typically the current hour rounded down — this allows the same event to trigger one notification per hour window maximum.

**Inbox insert:** `ON CONFLICT (idempotency_key) DO NOTHING`  
**Outbox insert:** `ON CONFLICT (idempotency_key) DO NOTHING`

---

## 11. Adding a New Provider

1. Add a row to `sys_ntf_providers_cd` via migration (code, name, channel_code, api_endpoint)
2. Create adapter file in `lib/notifications/adapters/` implementing `send(outboxRow): Promise<DeliveryResult>`
3. Add a case in the outbox processor to route `channel_code` + `provider_code` to the new adapter
4. Add required env vars to `.env.local` and document in `03_env_vars.md`
5. Add provider activation SQL to `Setup_And_Config/sql_scripts/02_activate_providers_and_channels.sql`

---

## 12. Permissions Reference

| Code | Grant to | Purpose |
|------|----------|---------|
| `notifications:read` | All roles | View own notification inbox |
| `notifications:manage` | Operator+ | Mark read, manage preferences |
| `notifications:view_log` | Admin+ | View delivery log |
| `notifications:configure` | Admin+ | Manage tenant channel settings |
| `notifications:send_test` | Admin+ | Send test notification |

Seeded in migration `0349_ntf_permissions_and_nav.sql`.

---

## 13. i18n Key Namespace

All notification UI keys live under the `notifications` namespace in `messages/en.json` and `messages/ar.json`.

Key structure:
```
notifications.title
notifications.bell.unreadCount
notifications.bell.markAllRead
notifications.bell.noNotifications
notifications.bell.viewAll
notifications.item.justNow
notifications.item.markRead
notifications.center.tabs.all
notifications.center.tabs.unread
notifications.center.tabs.orders
notifications.center.tabs.payments
notifications.center.tabs.system
notifications.center.empty
notifications.center.markAllRead
notifications.settings.title
notifications.settings.myPrefs
notifications.settings.channelSettings
notifications.settings.enableChannel
notifications.settings.marketingConsent
notifications.settings.quietHours
notifications.settings.quietHoursStart
notifications.settings.quietHoursEnd
notifications.settings.loadFailed
notifications.deliveryLog.title
notifications.deliveryLog.event
notifications.deliveryLog.channel
notifications.deliveryLog.recipient
notifications.deliveryLog.status
notifications.deliveryLog.retries
notifications.deliveryLog.date
notifications.deliveryLog.error
notifications.deliveryLog.empty
notifications.deliveryLog.allChannels
notifications.deliveryLog.allStatuses
notifications.deliveryLog.refresh
notifications.deliveryLog.loadFailed
```
