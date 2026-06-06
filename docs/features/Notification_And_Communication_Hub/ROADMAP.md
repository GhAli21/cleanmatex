# CMX-PRD-019 — Notification & Communication Hub
# Cross-Project Implementation Roadmap

**Date:** 2026-06-06  
**Next migration seq:** 0344  
**Status:** EXPLORATION COMPLETE — Awaiting approval to begin Phase 1 planning

---

## 1. Architectural Decisions (Locked)

| Decision | Choice | Rationale |
|---|---|---|
| Notification backend runtime | **web-admin native** (Next.js API routes) | cmx-api is still a stub; fastest path to production value |
| Real-time delivery (bell) | **Supabase Realtime** | Already integrated; zero new infra; RLS-scoped automatically |
| Job queue (Phase 2+) | **Supabase pg_cron + pg_net** | No persistent worker process needed; Supabase-native; PostgreSQL-backed |
| External channel dispatch | **Outbox pattern** → pg_cron polls `org_notification_outbox_dtl` → calls API route | Idempotent; retryable; audit trail |
| Provider secrets | **Env vars / HQ API** — never stored in DB JSONB | Security requirement |
| Feature flags | **HQ API** (`hq_ff_get_effective_values_batch`) — already exists (mig 0158) | CLAUDE.md rule: never query `sys_feature_flags_*` directly |

---

## 2. Project Ownership Split

```
cleanmatex (this project, F:\jhapp\cleanmatex)
├── ALL database migrations (0344-0352+)
├── web-admin/
│   ├── app/api/notifications/        ← REST API routes (dispatch, mark-read, preferences)
│   ├── lib/notifications/            ← Orchestrator, adapters, pg-boss-like job helpers
│   ├── src/features/notifications/   ← UI: bell, center page, settings page, delivery logs
│   └── config/navigation.ts          ← nav additions (+ DB migration dual-write)
└── supabase/migrations/0344-0352+    ← all new tables

cleanmatexsaas (sibling project, F:\jhapp\cleanmatexsaas)
├── platform-api/src/modules/notifications-hq/   ← NEW: HQ management module
│   ├── template-library/                         ← CRUD for global templates
│   ├── provider-config/                          ← Provider secrets API (secrets → env)
│   └── quota/                                    ← Quota enforcement API endpoint
└── platform-web/src/features/notifications-hq/  ← HQ management UI
    ├── template-library/
    ├── provider-health/
    └── quota-dashboard/
```

**RULE:** cleanmatexsaas never runs migrations. It only consumes cleanmatex DB via service-role API or Supabase Realtime.

---

## 3. What Already Exists (Migration 0053)

Migration `0053_notifications_tables.sql` already provides:

| Table | What's There | Action |
|---|---|---|
| `sys_notification_type_cd` | 12 notification types (ORDER_READY, PAYMENT_RECEIVED, etc.) | **Keep as-is.** The PRD's `sys_notification_events_cd` is additive and more granular — coexists. |
| `sys_notification_channel_cd` | 5 channels seeded: EMAIL, SMS, WHATSAPP, PUSH, IN_APP | **Keep as-is.** New migration adds WEB_SOCKET channel via INSERT only (no schema change needed — same table). |

The new schema introduces a parallel, more granular event catalog (`sys_notification_events_cd`) alongside the existing type-based system. These coexist: the simple type codes are for legacy/simple lookups; the event catalog is for the hub's routing engine.

---

## 4. Table Naming (30-char audit)

All new table names verified ≤ 30 characters. Abbreviation rule: `notification` → `notif` when needed.

### Global Catalog (sys_*)
| Table | Chars | Status |
|---|---|---|
| `sys_notif_categories_cd` | 23 | ✓ New in 0344 |
| `sys_notification_events_cd` | 26 | ✓ New in 0344 |
| `sys_notification_providers_cd` | 29 | ✓ New in 0346 |
| `sys_notification_templates_mst` | 30 | ✓ New in 0346 |
| `sys_notif_template_ver_dtl` | 26 | ✓ New in 0346 |
| `sys_notif_template_chan_dtl` | 27 | ✓ New in 0346 |

### Tenant Runtime (org_*)
| Table | Chars | Status |
|---|---|---|
| `org_notification_settings_cf` | 28 | ✓ New in 0347 |
| `org_notif_user_prefs_dtl` | 24 | ✓ New in 0347 |
| `org_notifications_mst` | 21 | ✓ New in 0348 |
| `org_notification_outbox_dtl` | 27 | ✓ New in 0348 |
| `org_notif_delivery_log_dtl` | 26 | ✓ New in 0348 |
| `org_notification_campaigns_mst` | 30 | ✓ New in 0349 |
| `org_notif_campaign_targets_dtl` | 30 | ✓ New in 0349 |
| `org_notification_usage_daily` | 28 | ✓ New in 0349 |
| `org_notification_audit_dtl` | 26 | ✓ New in 0349 |
| `org_notif_fcm_tokens_dtl` | 24 | ✓ New in 0350 (Phase 3) |

---

## 5. Schema Bug Fixes (Required)

These bugs exist in the PRD's reference SQL (`019_notification_schema.sql`) and MUST be corrected in the actual migrations:

### Bug 1 — Invalid PK with COALESCE expression
**Affected:** `org_notification_usage_daily`  
**PRD (wrong):** `PRIMARY KEY (tenant_org_id, channel_code, usage_date, coalesce(provider_code,''))`  
**Fix:**
```sql
CREATE TABLE org_notification_usage_daily (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,  -- surrogate PK
  tenant_org_id UUID NOT NULL,
  channel_code TEXT NOT NULL,
  usage_date DATE NOT NULL,
  provider_code TEXT,                              -- nullable; NULL = no specific provider
  -- ... metrics columns ...
  UNIQUE (tenant_org_id, channel_code, usage_date, provider_code)
  -- Upsert: ON CONFLICT (tenant_org_id, channel_code, usage_date, provider_code) DO UPDATE
);
```
Note: PostgreSQL does NOT allow expression columns in primary keys. Surrogate UUID + unique index is the correct fix.

### Bug 2 — Table names exceeding 30 chars (PRD used full words)
Fixed in Section 4 above. Using `notif` abbreviation consistently.

### Bug 3 — Missing FCM tokens table
The PRD has no table for device push tokens. Added as `org_notif_fcm_tokens_dtl` in migration 0350 (Phase 3).

### Bug 4 — Provider secrets in JSONB (security issue)
**PRD:** `provider_config_jsonb JSONB` in `sys_notification_providers_cd`  
**Fix:** Store only non-sensitive metadata in DB. Provider API keys go to env vars. HQ API returns short-lived config reference, not raw secrets.

### Bug 5 — Missing branch_id in preferences
`org_notif_user_prefs_dtl` must include `branch_id` for multi-branch tenant support:
```sql
branch_id UUID REFERENCES org_branches_mst(id) -- NULL = applies to all branches
```

### Bug 6 — Missing bilingual fields
`sys_notification_templates_mst` and `sys_notif_categories_cd` must have `name2 TEXT` and `description2 TEXT` for Arabic.

---

## 6. Migration Sequence (0344 → 0352)

| Seq | File | Contents | Phase |
|---|---|---|---|
| 0344 | `notif_catalog_schema` | `sys_notif_categories_cd`, `sys_notification_events_cd`, event-channel default mappings table, WEB_SOCKET channel row in `sys_notification_channel_cd` | 1 |
| 0345 | `notif_catalog_seed` | All 27 categories + 116 events seeded. Keep separate for re-seedability. | 1 |
| 0346 | `notif_templates_schema` | `sys_notification_providers_cd`, `sys_notification_templates_mst`, `sys_notif_template_ver_dtl`, `sys_notif_template_chan_dtl`. No provider secrets in DB. | 1 |
| 0347 | `notif_tenant_settings` | `org_notification_settings_cf`, `org_notif_user_prefs_dtl` (with `branch_id`). RLS on all org_* tables. | 1 |
| 0348 | `notif_runtime_tables` | `org_notifications_mst`, `org_notification_outbox_dtl`, `org_notif_delivery_log_dtl`. RLS. Realtime enabled on `org_notifications_mst`. Indexes. | 1 |
| 0349 | `notif_permissions_seed` | Permission codes for notification hub. All in one dedicated migration. | 1 |
| 0350 | `notif_campaign_tables` | `org_notification_campaigns_mst`, `org_notif_campaign_targets_dtl`, `org_notification_usage_daily` (fixed PK), `org_notification_audit_dtl`. Feature flag seeds. RLS. | 4 |
| 0351 | `notif_fcm_tokens` | `org_notif_fcm_tokens_dtl`: device_id, token, platform, last_verified_at, failure_count, is_active. RLS. | 3 |
| 0352 | `notif_nav_components` | `sys_components_cd` + `sys_auth_permissions` rows for notification nav entries (dual-write requirement). | 1 |

> **RULE:** Create SQL files only. STOP after each migration and wait for user confirmation of application before continuing.

---

## 7. Permissions Required

New permission codes to seed in migration 0349 (resource:action format):

**cleanmatex (tenant-level):**
```
notifications:read          — View own notifications in bell/center
notifications:manage        — Mark read, clear, manage preferences
notifications:view_log      — View delivery log (admin)
notifications:configure     — Manage tenant channel settings
notifications:send_test     — Send test notification (admin)
```

**cleanmatexsaas (HQ-level):**
```
hq_notifications:read       — View HQ notification dashboard
hq_notifications:manage     — Manage global templates
hq_notifications:broadcast  — Send system-wide announcements
hq_notif_providers:manage   — Configure provider credentials
hq_notif_quota:read         — View tenant quota usage
hq_notif_quota:manage       — Adjust per-tenant quota limits
```

---

## 8. Navigation Entries (DUAL-WRITE REQUIRED)

### cleanmatex `web-admin/config/navigation.ts` additions

```typescript
// New top-level section (icon: 'bell', behind 'notifications_enabled' feature flag)
{
  key: 'notifications',
  label: 'Notifications',
  labelKey: 'nav.notifications',
  icon: 'bell',
  featureFlag: 'notifications_enabled',
  requiredPermission: 'notifications:read',
  children: [
    {
      key: 'notification-center',
      label: 'Notification Center',
      labelKey: 'nav.notifications.center',
      path: '/dashboard/notifications',
      requiredPermission: 'notifications:read',
    },
    {
      key: 'notification-delivery-log',
      label: 'Delivery Log',
      labelKey: 'nav.notifications.delivery_log',
      path: '/dashboard/notifications/delivery-log',
      requiredPermission: 'notifications:view_log',
    },
    {
      key: 'notification-settings',
      label: 'Channel Settings',
      labelKey: 'nav.notifications.settings',
      path: '/dashboard/notifications/settings',
      requiredPermission: 'notifications:configure',
    },
  ],
},
// Under existing marketing section:
{
  key: 'notification-campaigns',
  label: 'Push Campaigns',
  labelKey: 'nav.marketing.campaigns',
  path: '/dashboard/marketing/campaigns',
  requiredPermission: 'notifications:manage',
  featureFlag: 'campaign_notifications_enabled',
}
```

**Corresponding DB migration:** 0352 (`sys_components_cd` + permissions rows).

---

## 9. Feature Flags (consumed from HQ API)

These flags are managed in cleanmatexsaas `sys_feature_flags`. The tenant app NEVER queries the flags table directly — it calls `hq_ff_get_effective_values_batch`. Cache results 5 minutes in-process.

| Flag Code | Default | Phase |
|---|---|---|
| `notifications_enabled` | false | 1 |
| `email_notifications_enabled` | false | 2 |
| `sms_notifications_enabled` | false | 2 |
| `whatsapp_notifications_enabled` | false | 3 |
| `push_notifications_enabled` | false | 3 |
| `campaign_notifications_enabled` | false | 4 |

Each flag must be seeded in cleanmatexsaas's `sys_feature_flags` table by the cleanmatexsaas team before the corresponding phase deploys.

---

## 10. i18n Keys (EN/AR mandatory)

Minimum keys required for Phase 1:

```
notifications.bell.unread              — "{count} unread"
notifications.bell.no_notifications    — "No notifications"
notifications.bell.mark_all_read       — "Mark all as read"
notifications.bell.view_all            — "View all"
notifications.center.title             — "Notifications"
notifications.center.tabs.all          — "All"
notifications.center.tabs.unread       — "Unread"
notifications.center.tabs.orders       — "Orders"
notifications.center.tabs.payments     — "Payments"
notifications.center.tabs.system       — "System"
notifications.center.empty             — "No notifications yet"
notifications.center.mark_read         — "Mark as read"
notifications.settings.title           — "Notification Settings"
notifications.settings.channels        — "Channels"
notifications.settings.preferences     — "My Preferences"
```

Additional keys added per phase as channels/features are added.

---

## 11. Dispatch Architecture (web-admin native)

```
Business Event (order status change)
        │
        ▼
web-admin server action / route handler
        │
        ├─ writes → org_notifications_mst (IN_APP: direct, no queue)
        │               └─ Supabase Realtime → Bell UI (instant)
        │
        └─ writes → org_notification_outbox_dtl (external channels: queued)
                        │
                        ▼
              Supabase pg_cron (every 1 min)
                        │
                        ├─ calls pg_net → POST /api/notifications/process-outbox
                        │                        │
                        │                        ├─ EmailAdapter    (Phase 2)
                        │                        ├─ SmsAdapter      (Phase 2)
                        │                        ├─ WhatsAppAdapter (Phase 3)
                        │                        └─ PushAdapter     (Phase 3)
                        │
                        └─ updates org_notif_delivery_log_dtl
                             (status: SENT | FAILED_TEMPORARY | FAILED_PERMANENT)
```

**Retry logic:** pg_cron re-processes rows where `status = 'FAILED_TEMPORARY' AND next_retry_at <= NOW() AND retry_count < 5`.

**Idempotency:** Each outbox row has `idempotency_key TEXT UNIQUE`. Business layer generates this key before writing; duplicate events are silently skipped.

---

## 12. Phase-by-Phase Plan

---

### PHASE 1 — Foundation + In-App Notifications
**Project:** cleanmatex only  
**Duration:** ~2-3 weeks  
**Gate:** Schema + IN_APP bell working in web-admin  
**External dependencies:** None

#### Deliverables

**DB (migrations 0344-0349 + 0352):**
- [ ] Write migration 0344: catalog schema (categories, events, event-channel mappings)
- [ ] Write migration 0345: catalog seed (27 categories, 116 events)
- [ ] Write migration 0346: template schema (providers, templates_mst, template versions, template channels)
- [ ] Write migration 0347: tenant settings (channel settings cf, user prefs dtl with branch_id)
- [ ] Write migration 0348: runtime tables (notifications_mst, outbox_dtl, delivery_log_dtl) + enable Supabase Realtime on org_notifications_mst
- [ ] Write migration 0349: permissions seed (all 5 cleanmatex notification permissions)
- [ ] Write migration 0352: nav dual-write (sys_components_cd rows)
- [ ] **STOP → wait for user to apply each migration before proceeding**

**web-admin API routes (`web-admin/app/api/notifications/`):**
- [ ] `GET  /api/notifications` — fetch paginated notifications for current user
- [ ] `GET  /api/notifications/unread-count` — count of unread
- [ ] `PATCH /api/notifications/[id]/read` — mark single notification read
- [ ] `PATCH /api/notifications/read-all` — mark all read
- [ ] `POST /api/notifications/dispatch` — internal: dispatch an event to recipients (server-to-server only, not public)

**web-admin lib (`web-admin/lib/notifications/`):**
- [ ] `orchestrator.ts` — receives event code + context, resolves recipients, routes to adapters
- [ ] `adapters/in-app.ts` — writes to `org_notifications_mst`
- [ ] `adapters/outbox.ts` — writes to `org_notification_outbox_dtl` (for external channels)
- [ ] `recipient-resolver.ts` — resolves event → recipient user IDs based on event defaults
- [ ] `event-emitter.ts` — typed emitter; business modules call this (not adapters directly)

**web-admin hooks:**
- [ ] `hooks/useNotificationBell.ts` — Supabase Realtime subscription + unread count + mark-read
- [ ] `hooks/useNotificationCenter.ts` — paginated fetch + tab filtering + optimistic updates

**web-admin UI components (`web-admin/src/features/notifications/`):**
- [ ] `ui/NotificationBell.tsx` — bell icon + unread badge (reusable; plugged into CmxTopBar)
- [ ] `ui/NotificationItem.tsx` — single notification row (icon, title, time, read indicator) — reusable
- [ ] `ui/NotificationCenterPage.tsx` — full page `/dashboard/notifications` with 5 tab filters
- [ ] `ui/NotificationDrawer.tsx` — slide-in drawer (triggered from bell) — reusable

**Wire first 3 order events:**
- [ ] `order.created` → IN_APP → staff users
- [ ] `order.ready` → IN_APP → customer + assigned driver
- [ ] `order.cancelled` → IN_APP → customer + branch manager

**i18n:**
- [ ] Add Phase 1 keys to `web-admin/messages/en.json` and `ar.json`
- [ ] Run `npm run check:i18n` — must pass

**Build validation:**
- [ ] `npm run build` — must pass green

**Status tracking tasks (mandatory):**
- [ ] After each migration is confirmed applied: update this ROADMAP.md Phase 1 checkbox
- [ ] After bell UI is working: update STATUS.md in this folder

**Documentation tasks (end of Phase 1):**
- [ ] Run `/documentation` skill to generate: feature doc, permissions table, navigation tree, API routes list, i18n keys list, migration manifest
- [ ] Update `docs/dev/rules/integration-contracts.md` with HQ API contracts needed for Phase 2

---

### PHASE 2 — Email + Preferences UI + Outbox Worker
**Project:** cleanmatex primary; cleanmatexsaas starts provider config API  
**Duration:** ~4 weeks  
**Gate:** Email notifications delivered end-to-end; preferences UI working  
**External dependency:** cleanmatexsaas must expose `/platform/provider-config?channel=EMAIL` before Phase 2 dispatch can go live

#### Deliverables

**web-admin adapters:**
- [ ] `adapters/email.ts` — calls SendGrid API; reads provider config from HQ API (NOT from DB)
- [ ] `adapters/sms.ts` — stub (interface only; Twilio integration deferred to Phase 3)
- [ ] `adapters/outbox-processor.ts` — processes `org_notification_outbox_dtl` rows; calls channel adapters; writes delivery log

**API routes:**
- [ ] `POST /api/notifications/process-outbox` — called by pg_cron; processes pending outbox; idempotent
- [ ] `GET  /api/notifications/preferences` — get user + tenant channel preferences
- [ ] `PUT  /api/notifications/preferences` — update user preferences

**Supabase pg_cron setup:**
- [ ] Migration (separate) to register pg_cron job: `cron.schedule('notif-outbox', '* * * * *', $$SELECT net.http_post(...)$$)`
- [ ] pg_net extension must be enabled (check before writing migration)

**UI:**
- [ ] `ui/NotificationPreferencesPage.tsx` — `/dashboard/notifications/settings` — per-channel on/off per user
- [ ] `ui/NotificationChannelSettings.tsx` — tenant-level channel enable/disable (admin only)

**Wire 30 additional order/payment events:**
- [ ] Phase 2 event wiring list: order.delayed, order.delivered, payment.received, payment.failed, payment.reminder, delivery.started, delivery.otp_generated, + 23 more from catalog

**cleanmatexsaas tasks (Phase 2 start):**
- [ ] Create `notifications-hq` module in platform-api
- [ ] `GET /platform/provider-config?channel=EMAIL&tenantId=X` — returns provider config (never raw secrets; returns env-var-referenced config object)
- [ ] Seed email + SMS provider records

**i18n:**
- [ ] Add Phase 2 preference UI keys (EN + AR)
- [ ] Run `npm run check:i18n`

**WhatsApp template pre-submission (BLOCKING for Phase 3):**
- [ ] Submit 5 WhatsApp templates to META Business Manager at Phase 2 START:
  - `cmx_order_ready` — "Your order #{order_number} is ready for pickup at {branch_name}."
  - `cmx_order_cancelled` — "Your order #{order_number} has been cancelled."
  - `cmx_payment_received` — "Payment of {amount} {currency} received for order #{order_number}."
  - `cmx_payment_reminder` — "Reminder: payment of {amount} is pending for order #{order_number}."
  - `cmx_order_delayed` — "Your order #{order_number} is delayed. New ETA: {estimated_time}."
- [ ] **2-7 business day approval window.** Track in STATUS.md.

**Status tracking:**
- [ ] Update ROADMAP.md Phase 2 checkboxes after each deliverable
- [ ] Track WhatsApp template approval status in STATUS.md

**Documentation:**
- [ ] Update integration-contracts.md with HQ provider config API contract (schema, auth, caching)
- [ ] Document outbox + pg_cron pattern in `docs/dev/` for reference

---

### PHASE 3 — WhatsApp + SMS + Push Notifications
**Project:** cleanmatex primary + cleanmatexsaas quota API  
**Duration:** ~4 weeks  
**Gate:** All 4 external channels live; FCM token management working  
**External dependency:** META WhatsApp template approval (submitted in Phase 2); FCM project setup

#### Deliverables

**DB:**
- [ ] Migration 0351: `org_notif_fcm_tokens_dtl` (device_id, token, platform, last_verified_at, failure_count, is_active). RLS.

**Adapters:**
- [ ] `adapters/whatsapp.ts` — Meta Business API / Twilio BSP; reads provider config from HQ API
- [ ] `adapters/sms.ts` — full Twilio implementation (was stub in Phase 2)
- [ ] `adapters/push.ts` — FCM v1 API; reads FCM tokens from `org_notif_fcm_tokens_dtl`

**FCM token management:**
- [ ] `POST /api/notifications/fcm-token` — register/refresh device token
- [ ] `DELETE /api/notifications/fcm-token` — deregister on logout
- [ ] FCM error handling: mark token `is_active = false` on UNREGISTERED/INVALID_ARGUMENT
- [ ] Weekly pg_cron cleanup: remove tokens with `failure_count > 3 OR last_verified_at < NOW() - INTERVAL '90 days'`

**Quiet hours enforcement:**
- [ ] Read `org_notification_settings_cf.quiet_hours_start/end` per tenant
- [ ] Non-URGENT/CRITICAL messages: if current time in quiet hours → set `org_notification_outbox_dtl.scheduled_at = quiet_end_time`
- [ ] URGENT + CRITICAL: bypass quiet hours always

**Marketing consent check:**
- [ ] Before dispatching any event with `is_transactional = false`: check `org_notif_user_prefs_dtl.marketing_consent = true`
- [ ] If no consent → set outbox status to SKIPPED with reason `NO_MARKETING_CONSENT`

**cleanmatexsaas tasks (Phase 3):**
- [ ] `GET /platform/tenants/:id/notification-quota` — returns per-channel quota used vs limit for current month
- [ ] Quota enforcement: cleanmatex calls this before dispatching to external channels; if over quota → status = SKIPPED reason = QUOTA_EXCEEDED
- [ ] HQ Template Library UI: CRUD for `sys_notification_templates_mst` and versions
- [ ] Provider health dashboard: show per-provider success/failure rates from delivery log

**Status tracking:**
- [ ] Update ROADMAP.md Phase 3 checkboxes
- [ ] Record WhatsApp template approval status (approved date + template IDs)

**Documentation:**
- [ ] Update integration-contracts.md with quota API contract
- [ ] Document FCM token lifecycle in feature docs

---

### PHASE 4 — Campaign Engine
**Project:** cleanmatex primary + cleanmatexsaas quota enforcement  
**Duration:** ~4 weeks  
**Gate:** Campaign feature flag ON; campaign create → schedule → deliver working  
**Feature flag:** `campaign_notifications_enabled`

#### Deliverables

**DB:**
- [ ] Migration 0350: `org_notification_campaigns_mst`, `org_notif_campaign_targets_dtl`, `org_notification_usage_daily` (fixed PK: surrogate UUID + unique index), `org_notification_audit_dtl`. RLS on all.
- [ ] Campaign state machine: DRAFT → PENDING_APPROVAL → APPROVED → SCHEDULED → RUNNING → COMPLETED; PAUSED; FAILED; CANCELLED

**API routes:**
- [ ] `POST /api/notifications/campaigns` — create campaign
- [ ] `GET  /api/notifications/campaigns` — list with pagination/filter
- [ ] `PATCH /api/notifications/campaigns/[id]/status` — state transitions
- [ ] `POST /api/notifications/campaigns/[id]/test` — send test to self

**pg_cron jobs:**
- [ ] Campaign scheduler: every minute, check APPROVED campaigns where `scheduled_at <= NOW()` → start processing
- [ ] Campaign processor: picks next batch of targets → enqueues in outbox → marks batch done

**UI:**
- [ ] Campaign list page: `/dashboard/marketing/campaigns` (behind feature flag)
- [ ] Campaign create wizard: target segment → channel → template → schedule
- [ ] Campaign detail/analytics page: delivery stats, open rates

**Consent gate:**
- [ ] All campaign sends check marketing consent (campaigns are non-transactional by definition)
- [ ] Opt-out from campaign immediately updates preference

**cleanmatexsaas tasks (Phase 4):**
- [ ] Campaign quota limits per plan tier (e.g., Free: 0 campaigns, Starter: 2/mo, Pro: 20/mo)
- [ ] Campaign quota dashboard in HQ

**Status tracking:**
- [ ] Update ROADMAP.md Phase 4 checkboxes

**Documentation:**
- [ ] Document campaign state machine + consent rules

---

### cleanmatexsaas — Phase A: HQ Template Management (Runs parallel to cleanmatex Phase 2-3)
**Duration:** ~3 weeks alongside cleanmatex Phase 2

- [ ] Module scaffold: `platform-api/src/modules/notifications-hq/`
- [ ] Template CRUD API: `GET/POST/PUT/DELETE /platform/notification-templates`
- [ ] Template versioning: promote DRAFT → APPROVED; retire old versions
- [ ] Sync API: `POST /platform/templates/sync` — push approved templates to cleanmatex's `sys_notification_templates_mst`
- [ ] HQ UI: template editor with bilingual (EN/AR) fields, channel preview per channel
- [ ] Guard: only users with `hq_notifications:manage` permission can approve templates

### cleanmatexsaas — Phase B: Provider Config API (MUST complete before cleanmatex Phase 2 dispatch)
**Duration:** ~1 week (quick, high priority)

- [ ] `sys_notification_providers_cd` records seeded in cleanmatex (via cleanmatex migration 0346)
- [ ] Provider credential resolution: env-var lookup by provider code + channel code
- [ ] API: `GET /platform/provider-config?channel=EMAIL` — returns `{ provider: 'sendgrid', api_endpoint: '...', from_email: '...' }` (NO raw API keys in response)
- [ ] Short-lived config object (5-min cache, signed response)
- [ ] Guard: `hq_notif_providers:manage` for credential rotation endpoints

### cleanmatexsaas — Phase C: System Broadcast Center (Parallel to cleanmatex Phase 3+)
**Duration:** ~2 weeks

- [ ] `POST /platform/broadcasts` — send system-wide announcement to all tenants (or tenant subset)
- [ ] Broadcasts routed through cleanmatex's IN_APP channel (no external channel for broadcasts)
- [ ] HQ UI: broadcast composer + target filter (all tenants / plan tier / specific tenants)
- [ ] Broadcast history + delivery stats (aggregate, not per-tenant privacy)

---

## 13. API Contracts (Cross-Project)

These must be formally documented in `docs/dev/rules/integration-contracts.md` before implementation.

| Contract | Method | Owner | Consumer | Phase |
|---|---|---|---|---|
| Provider config | `GET /platform/provider-config?channel={code}&tenantId={id}` | cleanmatexsaas | cleanmatex | 2 |
| Quota check | `GET /platform/tenants/{id}/notification-quota` | cleanmatexsaas | cleanmatex | 3 |
| Template sync | `POST /platform/templates/sync` | cleanmatexsaas | cleanmatex (pull) | 3 |
| Feature flags (existing) | `hq_ff_get_effective_values_batch` (DB function, mig 0158) | cleanmatexsaas | cleanmatex | 1 |
| System broadcast | `POST /platform/broadcasts` | cleanmatexsaas | (self) | C |

**Authentication:** All cross-project API calls use service-role JWT scoped to the caller's project. Never pass tenant user JWTs across projects.

---

## 14. Risks & Mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| META WhatsApp template approval blocks Phase 3 | HIGH | Submit 5 templates at Phase 2 start (2-7 day window). Track in STATUS.md. |
| pg_net extension not enabled in Supabase | MEDIUM | Check before writing pg_cron migration. If unavailable, use pg_cron + separate polling script. |
| Supabase Realtime RLS not filtering correctly | MEDIUM | Test isolation: two different tenants must not see each other's notifications. Write isolation test before Phase 1 ships. |
| FCM token expiry without silent failure logging | MEDIUM | Mark `is_active = false` + log failure. Weekly cleanup job. Never retry token with failure_count > 3. |
| Provider secrets exposed in logs | HIGH | Adapters must never log full API keys. Use masked logging (`sk-****${last4}`). |
| Outbox table grows unbounded | MEDIUM | Add pg_cron job: archive rows older than 90 days in SENT/DELIVERED status to `org_notification_audit_dtl`. |
| URGENT/CRITICAL notifications delayed by quiet hours | HIGH | Quiet hours bypass is enforced before scheduling. Priority enum comparison: `CRITICAL > URGENT > HIGH > NORMAL > LOW`. |
| Marketing consent missing for new customers | MEDIUM | Consent defaults to `false`. All marketing events check consent before writing outbox. |

---

## 15. Phase 1 Quick Wins (Sprint 1 Definition of Done)

At the end of Phase 1, these MUST work in the browser:

1. Notification bell in the header shows an unread count badge
2. Clicking the bell opens a drawer with the last 20 notifications
3. Creating an order triggers an IN_APP notification to the creator (appears in real-time without page refresh)
4. Marking a notification as read clears it from the unread count
5. "Mark all read" button works
6. Notification center page (`/dashboard/notifications`) shows paginated history with tab filtering
7. All text is bilingual (EN/AR, RTL layout correct for Arabic)
8. `npm run build` passes green

---

## 16. Status

| Phase | Status | Last Updated |
|---|---|---|
| Exploration | ✅ COMPLETE | 2026-06-06 |
| Roadmap | ✅ COMPLETE | 2026-06-06 |
| Phase 1 — Foundation + In-App | ⏳ Awaiting approval | — |
| Phase 2 — Email + Prefs | ⏳ Not started | — |
| Phase 3 — WhatsApp + SMS + Push | ⏳ Not started | — |
| Phase 4 — Campaign Engine | ⏳ Not started | — |
| HQ Phase A — Template Mgmt | ⏳ Not started | — |
| HQ Phase B — Provider Config API | ⏳ Not started | — |
| HQ Phase C — Broadcast Center | ⏳ Not started | — |

---

## GATE — Approval Required

**This roadmap is complete. No code or migrations will be written until explicit approval.**

To approve, confirm:
1. Phase 1 plan is approved → begin migration writing (0344-0349 + 0352)
2. Any adjustments needed before starting?
3. cleanmatexsaas Phase B (provider config API) must start in parallel — confirm who owns it

---

*Generated: 2026-06-06 | Roadmap version: 1.0 | Next migration: 0344*
