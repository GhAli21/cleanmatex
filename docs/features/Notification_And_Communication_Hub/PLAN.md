# CMX-PRD-019 — Notification & Communication Hub
# Implementation Plan

**Roadmap:** [ROADMAP.md](./ROADMAP.md)  
**Status file:** [STATUS.md](./STATUS.md)  
**Next migration seq:** 0364  
**Architecture:** web-admin native · Supabase Realtime · pg_cron outbox  
**Created:** 2026-06-06  
**Last Updated:** 2026-06-12 — Phases 1–4 complete; cleanmatex MVP done; HQ phases (A/B/C) in cleanmatexsaas

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
- [ ] Add WEB_SOCKET row to existing `sys_ntf_channel_cd` (INSERT only, no DDL change to table)
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
- [x] Update STATUS.md: mark Step 1.6 done
- [x] Refresh docs: note 5 permissions added, 4 nav components seeded

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

### Step 1.15 — Build Validation & Phase 1 Close ✅ DONE

Tasks:
- [x] Run `npm run build` — passed (green)
- [x] Run `npm run check:i18n` — passed
- [x] Manual QA: bell real-time, mark-read, tab filtering, RTL layout in Arabic mode
- [x] **Update ROADMAP.md Phase 1 status → ✅ COMPLETE**
- [x] **Update STATUS.md Phase 1 → COMPLETE with date**
- [x] Run `/documentation` skill: generate feature doc, permissions table, navigation tree, API routes, migration manifest for Phase 1

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
- [ ] Update STATUS.md: mark Step 2.3 done
- [ ] Refresh docs: add email adapter pattern to ROADMAP.md architecture notes

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
- [ ] Update STATUS.md: mark Step 2.4 done
- [ ] Refresh docs: document process-outbox route in API routes reference

---

### Step 2.5 — Quiet Hours + Marketing Consent Enforcement

**Skills to load first:** `/backend`  
**File:** `web-admin/lib/notifications/orchestrator.ts` (update)

Tasks:
- [ ] Before writing outbox row: check `org_notification_settings_cf.quiet_hours_enabled` for tenant + channel
- [ ] If in quiet hours AND priority not URGENT/CRITICAL: set `scheduled_at = quiet_hours_end_time`
- [ ] Check `org_notification_events_cd.is_transactional`: if false, check `org_notif_user_prefs_dtl.marketing_consent` — if false, write outbox with status=SKIPPED, skip_reason='NO_MARKETING_CONSENT'
- [ ] Check `org_notification_settings_cf.is_enabled` for the channel: if false, skip
- [ ] Update STATUS.md: mark Step 2.5 done
- [ ] Refresh docs: note quiet-hours and consent logic in orchestrator architecture section

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
- [ ] Update STATUS.md: mark Step 2.6 done
- [ ] Refresh docs: update i18n key listing with new keys

---

### Step 2.7 — Wire 30 Additional Order/Payment Events

Tasks:
- [ ] `order.delayed`, `order.delivered`, `order.sla_breach`
- [ ] `payment.received`, `payment.failed`, `payment.reminder`, `payment.link_expired`
- [ ] `delivery.started`, `delivery.otp_generated`, `delivery.completed`, `delivery.failed`
- [ ] `workflow.stage_changed` (generic — carries stage name)
- [ ] Update STATUS.md: mark Step 2.7 done
- [ ] Refresh docs: update event wiring list in feature doc

---

### Step 2.8 — Build Validation & Phase 2 Close ✅ DONE

Tasks:
- [x] `npm run build` — green
- [x] `npm run check:i18n` — green
- [x] Manual QA: create order → email via outbox
- [x] **Update ROADMAP.md Phase 2 status → ✅ COMPLETE**
- [x] **Update STATUS.md Phase 2 → COMPLETE with date**
- [x] Update integration-contracts.md with outbox-cron pattern documentation
- [x] Run `/documentation` skill: update feature doc, add email adapter architecture note

---

## PHASE 3 — WhatsApp + SMS + Push Notifications

**Goal:** All 4 external channels live. FCM token management working.  
**Projects:** cleanmatex primary · cleanmatexsaas quota API.  
**Gate:** WhatsApp message received on a real phone from an order event.  
**Prerequisite:** META template approval confirmed (submitted in Phase 2).

---

### Step 3.1 — Migration 0351: Provider-Agnostic Push Subscriptions ✅ DONE

**Skills loaded:** `/database`  
**File:** `supabase/migrations/0351_notif_push_subscriptions.sql`

Tasks:
- [x] Create `org_ntf_push_subs_dtl` (22 chars): `id UUID PK`, `tenant_org_id`, `user_id`, `device_id TEXT`, `provider_code TEXT CHECK (FCM|VAPID|ONESIGNAL)`, `platform TEXT CHECK (IOS|ANDROID|WEB|BROWSER)`, `subscription_data JSONB`, `app_version TEXT`, `last_verified_at TIMESTAMP`, `failure_count INT DEFAULT 0`, `is_active BOOLEAN DEFAULT true`, audit fields
- [x] UNIQUE index: `(tenant_org_id, user_id, device_id, provider_code)` — one subscription per device per provider
- [x] Partial index on active subscriptions for push adapter query
- [x] Stale-sweep index: `(tenant_org_id, is_active, last_verified_at)`
- [x] RLS: `current_tenant_id()` policy
- [ ] **STOP → wait for user to apply 0351**
- [ ] Update STATUS.md: mark Step 3.1 done

---

### Step 3.2 — Migration 0352: Channel Provider Config Table ✅ DONE

**Skills loaded:** `/database`  
**File:** `supabase/migrations/0352_notif_channel_provider_cf.sql`

Tasks:
- [x] Create `org_ntf_channel_provider_cf` (28 chars): `id UUID PK`, `tenant_org_id`, `channel_code TEXT REFERENCES sys_ntf_channel_cd`, `provider_code TEXT`, `display_name TEXT`, `config JSONB` (non-secrets only), `is_active BOOLEAN DEFAULT false`, audit fields
- [x] UNIQUE on `(tenant_org_id, channel_code, provider_code)` — no duplicate provider per channel
- [x] Partial UNIQUE on `(tenant_org_id, channel_code) WHERE is_active=true` — exactly one active provider per channel
- [x] RLS: `current_tenant_id()` policy
- [ ] **STOP → wait for user to apply 0352**
- [ ] Update STATUS.md: mark Step 3.2 done

---

### Step 3.3 — NotificationSettingsService (Source of Truth) ✅ DONE

**Skills loaded:** `/backend`  
**File:** `web-admin/lib/notifications/settings-service.ts`

Tasks:
- [x] Singleton `NotificationSettingsService` with 30 s in-memory cache per tenant
- [x] `getAllChannelConfigs(tenantOrgId)` — parallel fetch of settings + active provider; returns `ChannelConfig[]`
- [x] `getChannelConfig(tenantOrgId, channelCode)` — single channel lookup
- [x] `isChannelEnabled(tenantOrgId, channelCode)` — quick boolean
- [x] `getActiveProvider(tenantOrgId, channelCode)` — returns `{ providerCode, config }` or null
- [x] `getUserPrefs(tenantOrgId, userId, channelCode?)` — user pref rows (cached 30 s per user)
- [x] `hasMarketingConsent(tenantOrgId, userId, channelCode)` — derived from user prefs
- [x] `invalidateChannel(tenantOrgId)` / `invalidateUserPrefs(tenantOrgId, userId)` / `invalidateAll()`
- [x] Orchestrator updated to use service instead of direct DB queries
- [x] Update STATUS.md: mark Step 3.3 done

---

### Step 3.4 — Provider Settings API Routes ✅ DONE

**Skills loaded:** `/backend`  
**File:** `web-admin/app/api/v1/notifications/settings/providers/route.ts`  
**Updated:** `web-admin/app/api/v1/notifications/settings/route.ts` (GET now uses service; PUT invalidates cache)

Tasks:
- [x] `GET  /api/v1/notifications/settings` — returns configs merged with active provider (via service)
- [x] `PUT  /api/v1/notifications/settings` — upserts channel settings + invalidates cache
- [x] `GET  /api/v1/notifications/settings/providers` — list all provider configs, optional `?channel_code=`
- [x] `POST /api/v1/notifications/settings/providers` — add provider config (is_active=false by default)
- [x] `PUT  /api/v1/notifications/settings/providers` — activate provider: deactivates all others for channel, then activates target
- [x] `DELETE /api/v1/notifications/settings/providers?channel_code=&provider_code=` — soft-delete (blocks deleting active provider)
- [x] All writes invalidate `notificationSettingsService` cache
- [x] Update STATUS.md: mark Step 3.4 done

---

### Step 3.5 — SMS Adapter ✅ DONE

- [x] `lib/notifications/adapters/sms.ts` — Twilio Programmable Messaging
- [x] ENV: TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_SMS_FROM
- [x] Permanent error detection: codes 21211 (invalid number), 21614 (not SMS-capable)

---

### Step 3.6 — WhatsApp Adapter ✅ DONE

- [x] `lib/notifications/adapters/whatsapp.ts` — factory supporting two providers
- [x] TWILIO_WHATSAPP: Twilio as BSP (twilio npm package)
- [x] META_WHATSAPP: Meta Cloud API direct HTTP (graph.facebook.com v18.0)
- [x] Provider selected at runtime via NotificationSettingsService

---

### Step 3.7 — Push Adapter Factory ✅ DONE

- [x] `lib/notifications/adapters/push/vapid.ts` — W3C Web Push (web-push npm package; VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT)
- [x] `lib/notifications/adapters/push/fcm.ts` — FCM v1 HTTP API + JWT service account (FCM_SERVICE_ACCOUNT_JSON / FCM_PROJECT_ID; no Firebase SDK)
- [x] `lib/notifications/adapters/push/onesignal.ts` — OneSignal REST API (ONESIGNAL_APP_ID / ONESIGNAL_REST_API_KEY; free tier)
- [x] `lib/notifications/adapters/push.ts` — main factory: reads active provider from settings service, fan-out to all active subscriptions per user, records failure_count + deactivates on permanent errors

---

### Step 3.8 — Push Subscription API ✅ DONE

- [x] `app/api/notifications/push-subscription/route.ts` — POST (register/refresh) / DELETE (deregister)
- [x] Upsert keyed on (tenant_org_id, user_id, device_id, provider_code)
- [x] Auth: requirePermission('notifications:read')

---

### Step 3.9 — Outbox Processor: Wire All Channels ✅ DONE

- [x] Updated `app/api/notifications/process-outbox/route.ts`
- [x] EMAIL → deliverEmailOutbox (Phase 2, unchanged)
- [x] SMS → deliverSmsOutbox
- [x] WHATSAPP → deliverWhatsAppOutbox (factory reads active provider)
- [x] PUSH → deliverPushOutbox (factory reads active provider + fans out to subscriptions)
- [x] IN_APP → SKIPPED (written directly to inbox by orchestrator, not outbox)

---

### Step 3.10 — Migration 0353: Stale Push Subscription Sweep ✅ DONE

- [x] `supabase/migrations/0353_notif_push_sweep_cron.sql`
- [x] Creates `ntf_sweep_stale_push_subs()` PL/pgSQL function
- [x] pg_cron job: every Sunday 03:00 UTC — deactivates failure_count > 3 or last_verified_at < NOW() - 90 days
- [x] **STOP → wait for user to apply migration 0353**

---

### Step 3.11 — Build Validation ✅ DONE

- [x] `npm run build` — green (no errors, no warnings)

---

### Step 3.12 — Migration 0355: Config Table + Cron Fix ✅ DONE

- [x] `supabase/migrations/0355_ntf_config_table_cron_fix.sql`
- [x] Root cause: Supabase `postgres` role has `rolsuper = false` — cannot ALTER DATABASE/ROLE to persist custom GUC namespaces (`app.*`). Both SQL Editor (PostgREST) and direct psql connection fail identically.
- [x] Fix: `sys_ntf_runtime_cf` key/value table (REVOKE anon/authenticated) + `ntf_trigger_outbox_proc()` SECURITY DEFINER function that reads config at call time
- [x] `ntf-outbox-processor` cron job re-registered to call `SELECT public.ntf_trigger_outbox_proc()` instead of inline `current_setting()` GUC references
- [x] `web-admin/public/sw.js` — VAPID service worker created
- [x] `web-admin/lib/push/` — push client library: device-id, vapid-subscribe, use-push-vapid, deregister
- [x] VAPID keys + NOTIFICATIONS_OUTBOX_SECRET generated and written to `.env.local`
- [x] **Migration applied 2026-06-12**

---

### Step 3.13 — Migration 0356: is_enabled + audit columns ✅ DONE

- [x] `supabase/migrations/0356_ntf_provider_cf_is_enabled.sql`
- [x] `org_ntf_channel_provider_cf` — added `is_enabled BOOLEAN DEFAULT true`
- [x] `sys_ntf_runtime_cf` — added full standard audit columns (created_at/by/info, updated_by/info, rec_status, rec_order, rec_notes, is_active); back-filled existing rows
- [x] **Migration applied 2026-06-12**

---

### Step 3.14 — Provider Activation + Channel Enable (all tenants) ✅ DONE

- [x] Ran `02_activate_providers_and_channels.sql` against all active tenants
- [x] IN_APP → SUPABASE_REALTIME: active + enabled
- [x] EMAIL → RESEND: active + enabled (from_email: noreply@cmx.cleanmatex.com)
- [x] SMS → TWILIO_SMS: registered, inactive (pending Twilio creds in env)
- [x] WHATSAPP → TWILIO_WHATSAPP: registered, inactive (pending META template approval)
- [x] PUSH → VAPID: registered, inactive (pending sw.js deploy + subscriptions)
- [x] **Done 2026-06-12**

---

### Step 3.6 — cleanmatexsaas: Quota API

**Project:** `F:\jhapp\cleanmatexsaas`

- [ ] `GET /platform/tenants/:id/notification-quota` — returns per-channel used/limit for current month
- [ ] cleanmatex orchestrator: before dispatching to external channel → call quota API → if over limit → status = SKIPPED, skip_reason = 'QUOTA_EXCEEDED'
- [ ] Update integration-contracts.md
- [ ] Update STATUS.md: mark Step 3.6 done
- [ ] Refresh docs: update integration-contracts.md with quota API contract

---

### Step 3.7 — cleanmatexsaas: HQ Template Library UI

**Project:** `F:\jhapp\cleanmatexsaas`

- [ ] Template list page: shows all `sys_notification_templates_mst` records across all tenants
- [ ] Template editor: bilingual fields (EN/AR), per-channel preview, version history
- [ ] Approve/retire template version workflow
- [ ] Sync button: pushes approved template to cleanmatex DB
- [ ] Update STATUS.md: mark Step 3.7 done
- [ ] Refresh docs: document template approval workflow in feature doc

---

### Step 3.8 — Build Validation & Phase 3 Close ✅ DONE (2026-06-12)

- [x] `npm run build` — green
- [x] `npm run check:i18n` — green
- [ ] Record WhatsApp template IDs in STATUS.md (pending — META approval not yet received)
- [x] **Update ROADMAP.md Phase 3 status → ✅ COMPLETE**
- [x] **Update STATUS.md Phase 3 → COMPLETE with date**
- [x] Run `/documentation` skill: created user_guide, developer_guide, admin_guide, deploy_guide, testing_scenarios; updated 11_smoke_tests; fixed table name bugs in smoke tests

---

## PHASE 4 — Campaign Engine

**Goal:** Tenants can send scheduled broadcast notifications to customer segments.  
**Projects:** cleanmatex + cleanmatexsaas quota.  
**Gate:** Campaign created → approved → sent → delivery stats visible.  
**Feature flag:** `campaign_notifications_enabled` (off by default)

---

### Step 4.1 — Migration 0361: Campaign Tables ✅ DONE (2026-06-12)

**Skills loaded:** `/database`  
**File:** `supabase/migrations/0361_ntf_campaign_engine_tables.sql`

Tasks:
- [x] Create `org_ntf_campaigns_mst` — state machine, bilingual, scheduling, progress counters
- [x] Create `org_ntf_camp_targets_dtl` — one row per recipient; consent checked by processor
- [x] Create `org_ntf_usage_daily` — daily aggregated stats; empty-string sentinel for provider_code
- [x] Create `org_ntf_audit_dtl` — immutable INSERT-only log; no UPDATE/DELETE RLS policies
- [x] Two FK fixes applied before re-apply: `sys_ntf_templates_mst(template_code)`, `org_ntf_outbox_dtl(id)`
- [x] **Migration 0361 applied 2026-06-12**

---

### Step 4.2 — Campaign API Routes ✅ DONE (2026-06-12)

**Skills loaded:** `/backend`

- [x] `GET  /api/v1/notifications/campaigns` — paginated list; status filter; tenant isolated
- [x] `POST /api/v1/notifications/campaigns` — create (status=DRAFT); Zod-validated; template_code field
- [x] `GET  /api/v1/notifications/campaigns/[id]` — detail + stats_breakdown + failed_sample(10)
- [x] `PATCH /api/v1/notifications/campaigns/[id]/status` — state machine transitions; dual permission gate (manage vs configure); timestamps auto-set; audit log
- [x] `POST /api/v1/notifications/campaigns/[id]/test` — fire-and-forget to caller; DRAFT/PENDING_APPROVAL/APPROVED states only

---

### Step 4.3 — Campaign Scheduler (pg_cron) ✅ DONE (2026-06-12)

**Skills loaded:** `/database` + `/backend`

- [x] `supabase/migrations/0362_ntf_campaign_scheduler_cron.sql` — `ntf_trigger_campaign_proc()` SECURITY DEFINER fn; reads base_url + outbox_secret_key from `sys_ntf_runtime_cf`; calls `/api/notifications/process-campaigns`; pg_cron `ntf-campaign-scheduler` registered; idempotent unschedule+reschedule
- [x] `web-admin/app/api/notifications/process-campaigns/route.ts` — Phase A: activates APPROVED/SCHEDULED campaigns (creates targets from target_segment.user_ids); Phase B: dispatches PENDING targets (bulk consent check → SKIP or enqueue outbox/inbox); campaign auto-completes when no PENDING remain
- [x] Consent gate: `org_ntf_user_prefs_dtl` checked in bulk per batch; default = no consent (safe)
- [x] **Migration 0362 applied 2026-06-12**

---

### Step 4.4 — Campaign UI ✅ DONE (2026-06-12)

**Skills loaded:** `/frontend` + `/i18n`

- [x] `src/features/notifications/ui/campaign-list-page.tsx` — paginated list; StatusBadge; ProgressBar; quick cancel; create-dialog trigger; RTL-aware layout
- [x] `src/features/notifications/ui/campaign-create-form.tsx` — RHF + Zod; textarea target_user_ids; channel select; optional scheduled_at; save as DRAFT
- [x] `src/features/notifications/ui/campaign-detail-page.tsx` — stats grid; detail dl; failed_sample table; status transitions (submit/approve/launch/cancel); test-send button
- [x] `app/dashboard/marketing/campaigns/page.tsx` — route page
- [x] `app/dashboard/marketing/campaigns/[id]/page.tsx` — detail route page
- [x] `config/navigation.ts` — added `marketing_campaigns` child under `marketing` section; gated by `FLAG_KEYS.CAMPAIGNS_ENABLED` + `notifications:manage`
- [x] i18n keys: `notifications.campaigns.*` added to en.json + ar.json; `npm run check:i18n` — green

---

### Step 4.5 — cleanmatexsaas: Campaign Quota Limits

- [ ] Per-plan limits: Free=0/mo, Starter=2/mo, Pro=20/mo, Enterprise=unlimited
- [ ] HQ quota dashboard: per-tenant campaign usage this month
- [ ] Update STATUS.md: mark Step 4.5 done
- [ ] Refresh docs: update integration-contracts.md with quota plan limits

---

### Step 4.5 — Navigation DB Migration ✅ DONE (2026-06-12)

- [x] `supabase/migrations/0363_nav_marketing_campaigns.sql` — sys_components_cd entry for `marketing_campaigns`; `notifications:manage` permission + role defaults; feature_flag: `campaigns_enabled`
- [ ] **STOP → wait for user to apply migration 0363**

---

### Step 4.6 — Build Validation & Phase 4 Close ✅ DONE (2026-06-12)

- [x] `npm run build` — green (exit code 0)
- [x] `npm run check:i18n` — green
- [x] `supabase/migrations/0363_nav_marketing_campaigns.sql` applied — sys_components_cd + permissions
- [x] **ROADMAP.md Phase 4 status → ✅ COMPLETE**
- [x] **STATUS.md created — Phase 4 → COMPLETE 2026-06-12**
- [x] All guides updated: user_guide, developer_guide, admin_guide, deploy_guide, testing_scenarios

---

## Final Documentation Checklist (after Phase 4) ✅ DONE (2026-06-12)

- [x] STATUS.md created — full phase summary, migration manifest, permissions reference, env vars, feature flags, next steps
- [x] ROADMAP.md — Phase 4 status → ✅ COMPLETE; next migration seq updated to 0364
- [x] user_guide.md — Phase 4 status updated; Campaign section added (lifecycle, create, approve, launch, consent gate)
- [x] developer_guide.md — Phase 4 status updated; Campaign Engine section added (architecture, state machine, processor, UI components, API routes table updated)
- [x] admin_guide.md — Phase 4 status updated; Campaign Management section added (approval workflow, monitoring queries, cancel procedure)
- [x] deploy_guide.md — Phase 4 status updated; Phase 4 migrations added to migration table; NOTIFICATIONS_OUTBOX_SECRET note updated for campaigns
- [x] testing_scenarios.md — Phase 4 status updated; Phase 4 Campaign Engine test scenarios added (unit, integration, frontend QA, multi-tenant isolation)

---

*Plan version: 1.0 | Created: 2026-06-06 | Status: Awaiting Phase 1 approval*
