# CMX-PRD-019 — Notification & Communication Hub
# Implementation Plan

**Roadmap:** [ROADMAP.md](./ROADMAP.md)  
**Status file:** [STATUS.md](./STATUS.md)  
**Next migration seq:** 0350  
**Architecture:** web-admin native · Supabase Realtime · pg_cron outbox  
**Created:** 2026-06-06

---

## HOW TO USE THIS PLAN

- Work one phase at a time. Do NOT start the next phase without user confirmation.
- After each migration file is written → STOP and wait for user to apply it before continuing.
- After every phase → update STATUS.md checkboxes + ROADMAP.md status table.
- Load skills before writing: `/database` for SQL, `/frontend` for UI, `/i18n` for translations.

**Mandatory end-of-step tasks (add to EVERY step):**
1. `[ ] Update STATUS.md: mark Step X.Y done` — check off the step immediately after it is complete.
2. `[ ] Refresh docs: update any affected documentation files` — if the step adds schema, permissions, nav, API routes, i18n keys, or new components, note changes in ROADMAP.md and relevant docs/.
3. At the end of each PHASE: `[ ] Run /documentation skill` — generate/refresh the full feature doc set for everything completed so far.

---

## PHASE 1 — Foundation + In-App Notifications

**Goal:** Schema live, notification bell working in the browser, 3 order events firing.  
**Projects:** cleanmatex only.  
**Gate:** `npm run build` green + bell shows real-time notifications.

---

### Step 1.1 — Migration 0344: Event Catalog Schema

**Skills to load first:** `/database`  
**File:** `supabase/migrations/0344_notif_catalog_schema.sql`

Tasks:
- [ ] Create `sys_notif_categories_cd` (27 categories: ORDER, PAYMENT, DELIVERY, SECURITY, SYSTEM, MARKETING, …)
- [ ] Create `sys_notification_events_cd` (116 events: event_code, category_code, name, name2, default_channels[], priority, is_transactional, requires_consent, idempotency_key_pattern)
- [ ] Create `sys_notif_event_channel_defaults` (event_code × channel_code mapping table)
- [ ] Add WEB_SOCKET row to existing `sys_notification_channel_cd` (INSERT only, no DDL change to table)
- [ ] All bilingual fields present: `name TEXT`, `name2 TEXT`, `description TEXT`, `description2 TEXT`
- [ ] All table names ≤ 30 chars (verified in ROADMAP §4)
- [ ] Use `TEXT` not `VARCHAR` for all string columns
- [ ] Audit fields on each table: `created_at`, `created_by`, `updated_at`, `updated_by`, `rec_status`
- [ ] **STOP → wait for user to apply migration 0344**
- [ ] Update STATUS.md: mark Step 1.1 done

---

### Step 1.2 — Migration 0345: Event Catalog Seed

**Skills to load first:** `/database`  
**File:** `supabase/migrations/0345_notif_catalog_seed.sql`

Tasks:
- [ ] Seed all 27 categories from `notification_event_catalog.csv`
- [ ] Seed all 116 events from `notification_event_catalog.csv` — each row maps to one `sys_notification_events_cd` record
- [ ] Seed default channel mappings in `sys_notif_event_channel_defaults`
- [ ] `ON CONFLICT DO UPDATE` on all inserts (idempotent seed)
- [ ] Verify existing 0053 seeds are not duplicated (different table names — no conflict)
- [ ] **STOP → wait for user to apply migration 0345**
- [ ] Update STATUS.md: mark Step 1.2 done

---

### Step 1.3 — Migration 0346: Template Schema

**Skills to load first:** `/database`  
**File:** `supabase/migrations/0346_notif_templates_schema.sql`

Tasks:
- [ ] Create `sys_notification_providers_cd` — provider catalog (SENDGRID, TWILIO, FCM, META_WHATSAPP, INTERNAL). No API keys stored in DB. Only: `code`, `name`, `name2`, `channel_code`, `api_endpoint`, `is_active`, audit fields
- [ ] Create `sys_notification_templates_mst` — template header: `template_code`, `event_code FK`, `name`, `name2`, `description`, `description2`, `is_system`, `is_active`, `rec_status`, audit fields. Name is exactly 30 chars — confirm before writing.
- [ ] Create `sys_notif_template_ver_dtl` — versioned content: `version_number`, `template_id FK`, `subject`, `subject2`, `body`, `body2`, `status` (DRAFT/APPROVED/RETIRED), `approved_by`, `approved_at`, audit fields
- [ ] Create `sys_notif_template_chan_dtl` — per-channel rendering: `template_version_id FK`, `channel_code FK`, `rendered_subject`, `rendered_subject2`, `rendered_body`, `rendered_body2`, `metadata JSONB`
- [ ] All bilingual fields present
- [ ] **STOP → wait for user to apply migration 0346**
- [ ] Update STATUS.md: mark Step 1.3 done

---

### Step 1.4 — Migration 0347: Tenant Settings

**Skills to load first:** `/database`  
**File:** `supabase/migrations/0347_notif_tenant_settings.sql`

Tasks:
- [ ] Create `org_notification_settings_cf` — tenant channel config: `tenant_org_id`, `channel_code FK`, `is_enabled BOOLEAN`, `quiet_hours_enabled BOOLEAN`, `quiet_hours_start TIME`, `quiet_hours_end TIME`, `daily_limit INT`, `metadata JSONB`, audit fields. Composite PK: `(tenant_org_id, channel_code)`.
- [ ] Create `org_notif_user_prefs_dtl` — per-user preferences: `tenant_org_id`, `user_id`, `branch_id` (nullable — NULL = all branches), `channel_code FK`, `event_code FK` (nullable — NULL = all events), `is_enabled BOOLEAN`, `marketing_consent BOOLEAN DEFAULT false`, `consent_given_at TIMESTAMP`, `consent_ip TEXT`, audit fields
- [ ] Enable RLS on both `org_*` tables
- [ ] RLS policy on `org_notification_settings_cf`: `tenant_org_id = auth.jwt()->>'tenant_org_id'`
- [ ] RLS policy on `org_notif_user_prefs_dtl`: same tenant filter + `user_id = auth.uid()` for user reads
- [ ] Indexes: `(tenant_org_id, channel_code)` on settings; `(tenant_org_id, user_id, channel_code)` on prefs
- [ ] **STOP → wait for user to apply migration 0347**
- [ ] Update STATUS.md: mark Step 1.4 done

---

### Step 1.5 — Migration 0348: Runtime Tables

**Skills to load first:** `/database`  
**File:** `supabase/migrations/0348_notif_runtime_tables.sql`

Tasks:
- [ ] Create `org_notifications_mst` — the inbox: `id UUID PK`, `tenant_org_id`, `recipient_user_id`, `event_code`, `category_code`, `title TEXT`, `title2 TEXT`, `body TEXT`, `body2 TEXT`, `channel_code DEFAULT 'IN_APP'`, `priority`, `is_read BOOLEAN DEFAULT false`, `read_at TIMESTAMP`, `action_url TEXT`, `metadata JSONB`, `expires_at TIMESTAMP`, `idempotency_key TEXT UNIQUE`, audit fields, `rec_status`
- [ ] Create `org_notification_outbox_dtl` — dispatch queue: `id UUID PK`, `tenant_org_id`, `notification_id FK → org_notifications_mst`, `channel_code`, `recipient_address TEXT` (email/phone/token), `status TEXT` (QUEUED/PROCESSING/SENT/DELIVERED/READ/FAILED_TEMPORARY/FAILED_PERMANENT/SKIPPED/CANCELLED), `idempotency_key TEXT UNIQUE`, `scheduled_at TIMESTAMP DEFAULT NOW()`, `next_retry_at TIMESTAMP`, `retry_count INT DEFAULT 0`, `max_retries INT DEFAULT 5`, `error_message TEXT`, `provider_message_id TEXT`, `sent_at TIMESTAMP`, `delivered_at TIMESTAMP`, `skip_reason TEXT`, audit fields
- [ ] Create `org_notif_delivery_log_dtl` — immutable audit log: `id UUID PK`, `tenant_org_id`, `outbox_id FK`, `status TEXT`, `attempt_number INT`, `provider_code`, `provider_message_id TEXT`, `provider_response JSONB`, `error_code TEXT`, `error_message TEXT`, `duration_ms INT`, `logged_at TIMESTAMP DEFAULT NOW()`. NO update after insert.
- [ ] RLS on all three `org_*` tables
- [ ] Enable Supabase Realtime on `org_notifications_mst` (via `ALTER TABLE org_notifications_mst REPLICA IDENTITY FULL` + `ALTER PUBLICATION supabase_realtime ADD TABLE org_notifications_mst`)
- [ ] Indexes: `(tenant_org_id, recipient_user_id, is_read, created_at DESC)` on notifications_mst; `(tenant_org_id, status, scheduled_at)` on outbox_dtl; `(tenant_org_id, outbox_id)` on delivery log
- [ ] **STOP → wait for user to apply migration 0348**
- [ ] Update STATUS.md: mark Step 1.5 done

---

### Step 1.6 — Migration 0349: Permissions + Navigation Dual-Write ✅ DONE

**Skills loaded:** `/database`  
**File:** `supabase/migrations/0349_ntf_permissions_and_nav.sql` (permissions + nav combined — same pattern as mig 0343)

Tasks:
- [x] Seed 5 permissions into `sys_auth_permissions`:
  - `notifications:read` — View own notifications (all roles)
  - `notifications:manage` — Mark read, manage preferences (all except viewer)
  - `notifications:view_log` — View delivery log (admin+)
  - `notifications:configure` — Manage tenant channel settings (admin+)
  - `notifications:send_test` — Send test notification (admin+)
- [x] Role default permissions seeded via CROSS JOIN + NOT EXISTS guard
- [x] `sys_components_cd` rows inserted: `notifications` (section), `notifications_center`, `notifications_delivery_log`, `notifications_settings`
- [x] `parent_comp_id` resolved via post-INSERT UPDATE
- [x] **STOP → wait for user to apply migration 0349**
- [ ] Update STATUS.md: mark Step 1.6 done
- [ ] Refresh docs: note 5 permissions added, 4 nav components seeded

---

### Step 1.7 — Navigation Frontend Dual-Write (merged from original Steps 1.7+1.8)

**⚠️ DB side done in 0349. Frontend side still required.**

**Skills to load first:** `/frontend` + `/navigation`  
**File:** `web-admin/config/navigation.ts`

Tasks:
- [ ] Add `notifications` section with 3 children (center, delivery-log, settings) matching comp_codes in 0349
- [ ] Permission guards: `notifications:read` for section and center, `notifications:view_log` for delivery-log, `notifications:configure` for settings
- [ ] Verify `getNavigationForRole()` handles the new entries
- [ ] Update STATUS.md: mark Step 1.7 done
- [ ] Refresh docs: update navigation tree section in ROADMAP.md

---

### Step 1.8 — Navigation Frontend Dual-Write

**Skills to load first:** `/frontend` + `/navigation`  
**File:** `web-admin/config/navigation.ts`

Tasks:
- [ ] Add `notifications` section with 3 children (center, delivery-log, settings) — feature-flagged on `notifications_enabled`, permission: `notifications:read`
- [ ] Add `notification-campaigns` child under existing `marketing` section — feature-flagged on `campaign_notifications_enabled`, permission: `notifications:manage`
- [ ] Verify `getNavigationForRole()` logic handles the new entries correctly
- [ ] Update STATUS.md: mark Step 1.8 done

---

### Step 1.9 — Notification Library (web-admin/lib/notifications/)

**Skills to load first:** `/frontend` + `/backend`  
**Files:** `web-admin/lib/notifications/`

Tasks:
- [ ] `types.ts` — TypeScript types: `NotificationEvent`, `NotificationChannel`, `NotificationPriority`, `NotificationStatus`, outbox status enum, etc. All derived from DB constants (DB-mirror rule).
- [ ] `event-emitter.ts` — `emitNotificationEvent(event: NotificationEvent): Promise<void>`. Business modules call this. Never call adapters directly.
- [ ] `orchestrator.ts` — receives event → resolves recipients → checks feature flags (via HQ API) → checks channel settings → routes to adapters
- [ ] `recipient-resolver.ts` — maps `event_code` → recipient user IDs. Phase 1: static mapping (order events → order creator + branch manager)
- [ ] `adapters/in-app.ts` — writes to `org_notifications_mst`. Generates `idempotency_key`. Handles duplicate silently via ON CONFLICT DO NOTHING.
- [ ] `adapters/outbox.ts` — writes to `org_notification_outbox_dtl` for external channels (stub for Phase 1 — not used yet)
- [ ] `feature-flags.ts` — thin wrapper around `hq_ff_get_effective_values_batch`. 5-min in-process cache. Never query `sys_feature_flags_*` directly.
- [ ] Update STATUS.md: mark Step 1.9 done

---

### Step 1.10 — API Routes

**Skills to load first:** `/backend` + `/frontend`  
**Files:** `web-admin/app/api/notifications/`

Tasks:
- [ ] `GET  /api/notifications` — fetch paginated notifications for current user. Filter: `tenant_org_id` + `recipient_user_id` = current user. Params: `page`, `limit`, `is_read`, `category_code`.
- [ ] `GET  /api/notifications/unread-count` — returns `{ count: number }`. Cached 30s via Next.js route segment config.
- [ ] `PATCH /api/notifications/[id]/read` — mark single notification read. Validates `tenant_org_id` ownership.
- [ ] `PATCH /api/notifications/read-all` — mark all unread as read for current user.
- [ ] All routes: validate `tenant_org_id` from JWT. No cross-tenant data access.
- [ ] All routes: return bilingual content (both `title` + `title2`, `body` + `body2`)
- [ ] Update STATUS.md: mark Step 1.10 done

---

### Step 1.11 — React Hooks

**Skills to load first:** `/frontend`  
**Files:** `web-admin/src/features/notifications/hooks/`

Tasks:
- [ ] `useNotificationBell.ts` — Supabase Realtime subscription on `org_notifications_mst` filtered by `tenant_org_id` + `recipient_user_id`. Exposes: `unreadCount`, `recentNotifications[]`, `markRead(id)`, `markAllRead()`. Auto-increments badge on INSERT event.
- [ ] `useNotifications.ts` — paginated fetch via `/api/notifications`. Tab filtering state. Infinite scroll support.
- [ ] Update STATUS.md: mark Step 1.11 done

---

### Step 1.12 — UI Components

**Skills to load first:** `/frontend` + `/i18n`  
**Files:** `web-admin/src/features/notifications/ui/`

**Use Cmx components only.** Import from `@ui/primitives`, `@ui/overlays`, `@ui/data-display`. No raw HTML or shadcn primitives.

Tasks:
- [ ] `NotificationBell.tsx` — bell icon button (use `CmxButton` variant=ghost) + unread badge (use `Badge`) + `DropdownMenu` for quick list. Uses `useNotificationBell`. RTL-aware.
- [ ] `NotificationItem.tsx` — single notification row: category icon, title (bilingual), relative time, is_read indicator. Reusable across bell dropdown and center page.
- [ ] `NotificationDrawer.tsx` — slides in from right (use existing `cmx-dialog.tsx` or sheet pattern). Shows last 20 notifications. "View all" link to center page. "Mark all read" button.
- [ ] `NotificationCenterPage.tsx` — full page at `/dashboard/notifications`. Tabs: All / Unread / Orders / Payments / System. Uses `CmxDataTable` or `CmxDatagrid` for list. Empty state via `CmxEmptyState`.
- [ ] Wire `NotificationBell` into `CmxTopBar` or the existing app header layout component
- [ ] Update STATUS.md: mark Step 1.12 done

---

### Step 1.13 — i18n Keys

**Skills to load first:** `/i18n`  
**Files:** `web-admin/messages/en.json`, `web-admin/messages/ar.json`

Tasks:
- [ ] Add all Phase 1 i18n keys (bell, center, drawer, tabs, empty states, actions) in English
- [ ] Add Arabic translations for all keys
- [ ] Run `npm run check:i18n` — must pass with zero errors
- [ ] Update STATUS.md: mark Step 1.13 done

---

### Step 1.14 — Wire Order Events

**Skills to load first:** `/frontend` + `/backend`  
**Files:** Order-related server actions / route handlers

Tasks:
- [ ] Identify where order status changes are written (look for `org_order_history_dtl` inserts or order status update calls)
- [ ] Wire `order.created` event: after order insert → call `emitNotificationEvent({ code: 'order.created', orderId, ... })`
- [ ] Wire `order.ready` event: when status transitions to READY → emit
- [ ] Wire `order.cancelled` event: when status transitions to CANCELLED → emit
- [ ] Test: create an order in the browser → bell badge increments without page refresh
- [ ] Update STATUS.md: mark Step 1.14 done

---

### Step 1.15 — Build Validation & Phase 1 Close

Tasks:
- [ ] Run `npm run build` — must pass with zero errors
- [ ] Run `npm run check:i18n` — must pass
- [ ] Manual QA: bell real-time, mark-read, tab filtering, RTL layout in Arabic mode
- [ ] **Update ROADMAP.md Phase 1 status → ✅ COMPLETE**
- [ ] **Update STATUS.md Phase 1 → COMPLETE with date**
- [ ] Run `/documentation` skill: generate feature doc, permissions table, navigation tree, API routes, migration manifest for Phase 1
- [ ] **STOP → report to user, request Phase 2 approval**

---

## PHASE 2 — Email + Preferences UI + Outbox Worker

**Goal:** Email notifications delivered end-to-end via outbox. Preferences UI live.  
**Projects:** cleanmatex primary · cleanmatexsaas starts provider config API.  
**Gate:** Send a real email from an order event.  
**Prerequisite:** Phase 1 complete and deployed.

---

### Step 2.0 — cleanmatexsaas: Provider Config API (MUST complete before Step 2.5)

**Project:** `F:\jhapp\cleanmatexsaas`  
**Skills to load first:** `/backend`  
**Module:** `platform-api/src/modules/notifications-hq/`

Tasks:
- [ ] Scaffold `notifications-hq` NestJS module
- [ ] `GET /platform/provider-config?channel=EMAIL` — reads from env vars, returns non-secret config: `{ provider: 'sendgrid', from_email, api_endpoint }`. NEVER returns raw API key in response body.
- [ ] Guard: internal service-role JWT only (not tenant user JWTs)
- [ ] Update integration-contracts.md with this API contract
- [ ] Update STATUS.md: mark Step 2.0 done

---

### Step 2.1 — WhatsApp Template Pre-Submission (BLOCKING for Phase 3)

**Action required NOW — do not wait until Phase 3:**
- [ ] Submit to META Business Manager:
  - `cmx_order_ready` — "Your order #{order_number} is ready for pickup at {branch_name}."
  - `cmx_order_cancelled` — "Your order #{order_number} has been cancelled."
  - `cmx_payment_received` — "Payment of {amount} {currency} received for order #{order_number}."
  - `cmx_payment_reminder` — "Reminder: payment of {amount} is pending for order #{order_number}."
  - `cmx_order_delayed` — "Your order #{order_number} is delayed. New ETA: {estimated_time}."
- [ ] Record approval tracking in STATUS.md: submitted date, expected approval date, template IDs once approved
- [ ] Update STATUS.md: mark Step 2.1 initiated

---

### Step 2.2 — pg_cron + pg_net Outbox Worker Migration

**Skills to load first:** `/database`  
**File:** `supabase/migrations/0353_notif_outbox_cron.sql`

Tasks:
- [ ] Verify `pg_net` extension is enabled: `SELECT * FROM pg_extension WHERE extname = 'pg_net'`
- [ ] Verify `pg_cron` extension is enabled: `SELECT * FROM pg_extension WHERE extname = 'pg_cron'`
- [ ] Register pg_cron job: every 1 minute → `SELECT net.http_post(url := '{NEXT_JS_BASE_URL}/api/notifications/process-outbox', headers := '{"Authorization": "Bearer {SERVICE_KEY}"}', body := '{}'::jsonb)`
- [ ] Register retry-sweep pg_cron job: every 5 minutes → updates `next_retry_at` for FAILED_TEMPORARY rows where retry_count < max_retries
- [ ] **STOP → wait for user to apply migration 0353**
- [ ] Update STATUS.md: mark Step 2.2 done

---

### Step 2.3 — Email Adapter

**Skills to load first:** `/backend`  
**File:** `web-admin/lib/notifications/adapters/email.ts`

Tasks:
- [ ] `EmailAdapter.send(outboxRow): Promise<DeliveryResult>`
- [ ] Fetch provider config from cleanmatexsaas HQ API (Step 2.0 must be done first)
- [ ] Call SendGrid API with rendered subject + body from template
- [ ] On success: update outbox status → SENT, write delivery log row
- [ ] On failure (4xx provider error): status → FAILED_PERMANENT, write log
- [ ] On failure (5xx/timeout): status → FAILED_TEMPORARY, increment retry_count, set next_retry_at
- [ ] NEVER log full API key. Mask: `sk-****${key.slice(-4)}`

---

### Step 2.4 — Outbox Processor API Route

**Skills to load first:** `/backend`  
**File:** `web-admin/app/api/notifications/process-outbox/route.ts`

Tasks:
- [ ] `POST /api/notifications/process-outbox` — internal only; validate `Authorization: Bearer {SERVICE_KEY}`
- [ ] Fetch up to 50 QUEUED rows where `scheduled_at <= NOW()` and `tenant_org_id` filter
- [ ] For each row: mark PROCESSING → call appropriate adapter by `channel_code` → update status
- [ ] Re-fetch FAILED_TEMPORARY rows where `next_retry_at <= NOW()` and `retry_count < max_retries`
- [ ] Idempotent: skip rows with status not in (QUEUED, FAILED_TEMPORARY)

---

### Step 2.5 — Quiet Hours + Marketing Consent Enforcement

**Skills to load first:** `/backend`  
**File:** `web-admin/lib/notifications/orchestrator.ts` (update)

Tasks:
- [ ] Before writing outbox row: check `org_notification_settings_cf.quiet_hours_enabled` for tenant + channel
- [ ] If in quiet hours AND priority not URGENT/CRITICAL: set `scheduled_at = quiet_hours_end_time`
- [ ] Check `org_notification_events_cd.is_transactional`: if false, check `org_notif_user_prefs_dtl.marketing_consent` — if false, write outbox with status=SKIPPED, skip_reason='NO_MARKETING_CONSENT'
- [ ] Check `org_notification_settings_cf.is_enabled` for the channel: if false, skip

---

### Step 2.6 — Preferences UI

**Skills to load first:** `/frontend` + `/i18n`  
**Files:** `web-admin/src/features/notifications/ui/`

Tasks:
- [ ] `NotificationSettingsPage.tsx` at `/dashboard/notifications/settings`
  - Tab 1: "My Preferences" — per-channel toggles + marketing consent toggle. Uses `CmxSwitch`, `CmxCard`.
  - Tab 2: "Channel Settings" (admin only, `notifications:configure`): enable/disable channels tenant-wide. Quiet hours time pickers.
- [ ] `DeliveryLogPage.tsx` at `/dashboard/notifications/delivery-log` — table of delivery attempts. Columns: event, channel, recipient, status, timestamp, error. Uses `CmxDatagrid`. Filter by channel + status.
- [ ] Add Phase 2 i18n keys (EN + AR)
- [ ] Run `npm run check:i18n`

---

### Step 2.7 — Wire 30 Additional Order/Payment Events

Tasks:
- [ ] `order.delayed`, `order.delivered`, `order.sla_breach`
- [ ] `payment.received`, `payment.failed`, `payment.reminder`, `payment.link_expired`
- [ ] `delivery.started`, `delivery.otp_generated`, `delivery.completed`, `delivery.failed`
- [ ] `workflow.stage_changed` (generic — carries stage name)

---

### Step 2.8 — Build Validation & Phase 2 Close

Tasks:
- [ ] `npm run build` — green
- [ ] `npm run check:i18n` — green
- [ ] Manual QA: create order → email received in inbox
- [ ] **Update ROADMAP.md Phase 2 status → ✅ COMPLETE**
- [ ] **Update STATUS.md Phase 2 → COMPLETE with date**
- [ ] Update integration-contracts.md with outbox-cron pattern documentation
- [ ] Run `/documentation` skill: update feature doc, add email adapter architecture note
- [ ] **STOP → report to user, request Phase 3 approval**

---

## PHASE 3 — WhatsApp + SMS + Push Notifications

**Goal:** All 4 external channels live. FCM token management working.  
**Projects:** cleanmatex primary · cleanmatexsaas quota API.  
**Gate:** WhatsApp message received on a real phone from an order event.  
**Prerequisite:** META template approval confirmed (submitted in Phase 2).

---

### Step 3.1 — Migration 0351: FCM Tokens Table

**Skills to load first:** `/database`  
**File:** `supabase/migrations/0351_notif_fcm_tokens.sql`

Tasks:
- [ ] Create `org_notif_fcm_tokens_dtl`: `id UUID PK`, `tenant_org_id`, `user_id`, `device_id TEXT`, `token TEXT`, `platform TEXT` (IOS/ANDROID/WEB), `app_version TEXT`, `last_verified_at TIMESTAMP`, `failure_count INT DEFAULT 0`, `is_active BOOLEAN DEFAULT true`, audit fields
- [ ] RLS: `tenant_org_id = auth.jwt()->>'tenant_org_id'`
- [ ] Unique index: `(tenant_org_id, user_id, device_id)`
- [ ] Index: `(tenant_org_id, is_active, last_verified_at)`
- [ ] **STOP → wait for user to apply 0351**
- [ ] Update STATUS.md: mark Step 3.1 done

---

### Step 3.2 — FCM Token API Routes

- [ ] `POST /api/notifications/fcm-token` — register or refresh token
- [ ] `DELETE /api/notifications/fcm-token` — deregister on logout
- [ ] FCM error handler: on UNREGISTERED/INVALID_ARGUMENT → `is_active = false`, log

---

### Step 3.3 — WhatsApp Adapter

- [ ] `adapters/whatsapp.ts` — Twilio BSP / Meta Business API
- [ ] Uses approved template IDs stored in `sys_notif_template_chan_dtl`
- [ ] Template variable substitution from notification metadata JSONB
- [ ] Quiet hours bypass: URGENT/CRITICAL messages ignore quiet hours
- [ ] Delivery webhooks: `POST /api/notifications/webhooks/whatsapp` — update outbox + delivery log on provider callback

---

### Step 3.4 — SMS Adapter

- [ ] `adapters/sms.ts` — Twilio. Message truncated to 160 chars if needed.
- [ ] Provider config via HQ API (same pattern as email)

---

### Step 3.5 — Push Adapter

- [ ] `adapters/push.ts` — FCM v1 HTTP API
- [ ] Reads active tokens from `org_notif_fcm_tokens_dtl`
- [ ] Handle multi-device: one push per active token per user
- [ ] On `UNREGISTERED` FCM error → mark token `is_active = false`
- [ ] Weekly cleanup pg_cron: `UPDATE ... SET is_active = false WHERE failure_count > 3 OR last_verified_at < NOW() - INTERVAL '90 days'`

---

### Step 3.6 — cleanmatexsaas: Quota API

**Project:** `F:\jhapp\cleanmatexsaas`

- [ ] `GET /platform/tenants/:id/notification-quota` — returns per-channel used/limit for current month
- [ ] cleanmatex orchestrator: before dispatching to external channel → call quota API → if over limit → status = SKIPPED, skip_reason = 'QUOTA_EXCEEDED'
- [ ] Update integration-contracts.md

---

### Step 3.7 — cleanmatexsaas: HQ Template Library UI

**Project:** `F:\jhapp\cleanmatexsaas`

- [ ] Template list page: shows all `sys_notification_templates_mst` records across all tenants
- [ ] Template editor: bilingual fields (EN/AR), per-channel preview, version history
- [ ] Approve/retire template version workflow
- [ ] Sync button: pushes approved template to cleanmatex DB

---

### Step 3.8 — Build Validation & Phase 3 Close

- [ ] `npm run build` — green (both projects)
- [ ] `npm run check:i18n` — green
- [ ] Record WhatsApp template IDs in STATUS.md
- [ ] **Update ROADMAP.md Phase 3 status → ✅ COMPLETE**
- [ ] **Update STATUS.md Phase 3 → COMPLETE with date**
- [ ] Run `/documentation` skill: update all feature docs
- [ ] **STOP → report to user, request Phase 4 approval**

---

## PHASE 4 — Campaign Engine

**Goal:** Tenants can send scheduled broadcast notifications to customer segments.  
**Projects:** cleanmatex + cleanmatexsaas quota.  
**Gate:** Campaign created → approved → sent → delivery stats visible.  
**Feature flag:** `campaign_notifications_enabled` (off by default)

---

### Step 4.1 — Migration 0350: Campaign Tables

**Skills to load first:** `/database`  
**File:** `supabase/migrations/0350_notif_campaign_tables.sql`

Tasks:
- [ ] Create `org_notification_campaigns_mst` (exactly 30 chars): `id UUID PK`, `tenant_org_id`, `name TEXT`, `name2 TEXT`, `description TEXT`, `description2 TEXT`, `status TEXT` (DRAFT/PENDING_APPROVAL/APPROVED/SCHEDULED/RUNNING/COMPLETED/PAUSED/FAILED/CANCELLED), `channel_code`, `template_id FK`, `target_segment JSONB` (filter criteria), `scheduled_at TIMESTAMP`, `started_at`, `completed_at`, `total_targets INT`, `sent_count INT DEFAULT 0`, `failed_count INT DEFAULT 0`, `skip_count INT DEFAULT 0`, `created_by`, audit fields
- [ ] Create `org_notif_campaign_targets_dtl` (exactly 30 chars): `id UUID PK`, `tenant_org_id`, `campaign_id FK`, `recipient_user_id`, `recipient_address TEXT`, `status TEXT`, `outbox_id FK → org_notification_outbox_dtl`, `processed_at TIMESTAMP`, audit fields
- [ ] Create `org_notification_usage_daily` (28 chars): `id UUID DEFAULT gen_random_uuid() PRIMARY KEY` (surrogate — fixes PRD's coalesce() bug), `tenant_org_id`, `channel_code`, `usage_date DATE`, `provider_code TEXT` (nullable), `sent_count INT DEFAULT 0`, `failed_count INT DEFAULT 0`, `skip_count INT DEFAULT 0`, `cost_amount DECIMAL(19,4) DEFAULT 0`. UNIQUE `(tenant_org_id, channel_code, usage_date, provider_code)`. Upsert on this unique index.
- [ ] Create `org_notification_audit_dtl`: immutable event log for compliance — campaign state changes, consent changes, admin overrides
- [ ] RLS on all `org_*` tables
- [ ] **STOP → wait for user to apply 0350**
- [ ] Update STATUS.md: mark Step 4.1 done

---

### Step 4.2 — Campaign API Routes

- [ ] `POST /api/notifications/campaigns` — create
- [ ] `GET  /api/notifications/campaigns` — list, paginated
- [ ] `GET  /api/notifications/campaigns/[id]` — detail + stats
- [ ] `PATCH /api/notifications/campaigns/[id]/status` — state machine transitions
- [ ] `POST /api/notifications/campaigns/[id]/test` — send to self only

---

### Step 4.3 — Campaign Scheduler (pg_cron)

- [ ] Migration: add pg_cron job every minute: check APPROVED campaigns where `scheduled_at <= NOW()` → transition to RUNNING → batch-enqueue targets into `org_notification_outbox_dtl`
- [ ] Respect consent: all campaign targets must have `marketing_consent = true`
- [ ] Respect quota: check cleanmatexsaas quota API before enqueuing

---

### Step 4.4 — Campaign UI

- [ ] `CampaignListPage.tsx` at `/dashboard/marketing/campaigns`
- [ ] `CampaignCreateWizard.tsx` — 4 steps: target → channel → template → schedule
- [ ] `CampaignDetailPage.tsx` — delivery stats, open rate, cancel button
- [ ] Behind `campaign_notifications_enabled` feature flag: routes return 404 if flag is off
- [ ] Add i18n keys (EN + AR)

---

### Step 4.5 — cleanmatexsaas: Campaign Quota Limits

- [ ] Per-plan limits: Free=0/mo, Starter=2/mo, Pro=20/mo, Enterprise=unlimited
- [ ] HQ quota dashboard: per-tenant campaign usage this month

---

### Step 4.6 — Build Validation & Phase 4 Close

- [ ] `npm run build` — green
- [ ] `npm run check:i18n` — green
- [ ] **Update ROADMAP.md Phase 4 status → ✅ COMPLETE**
- [ ] **Update STATUS.md Phase 4 → COMPLETE with date**
- [ ] Run `/documentation` skill: generate complete feature documentation for the full notification hub
- [ ] **STOP → report to user — full MVP is complete**

---

## Final Documentation Checklist (after Phase 4)

Run `/documentation` skill to produce:
- [ ] Feature overview doc (what it does, who uses it)
- [ ] Permissions reference table (all 5 cleanmatex + 6 cleanmatexsaas codes)
- [ ] Navigation tree with routes and feature flags
- [ ] API routes reference (all `/api/notifications/*` endpoints)
- [ ] Migration manifest (0344–0352 with purpose per file)
- [ ] Integration contracts (cleanmatex ↔ cleanmatexsaas API contracts)
- [ ] i18n key listing (all keys added across all phases)
- [ ] Architecture diagram (event flow from business event → outbox → adapter → delivery)
- [ ] Update `docs/dev/rules/integration-contracts.md` with all contracts from Phases 2-3

---

*Plan version: 1.0 | Created: 2026-06-06 | Status: Awaiting Phase 1 approval*
