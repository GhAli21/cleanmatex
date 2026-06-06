# CMX-PRD-019 — Notification & Communication Hub
# Status Tracker

**Plan:** [PLAN.md](./PLAN.md)  
**Roadmap:** [ROADMAP.md](./ROADMAP.md)  
**Next migration seq:** 0350  
**Last updated:** 2026-06-06

---

## Phase 1 — Foundation + In-App Notifications

**Status:** ✅ COMPLETE (2026-06-06)  
**Gate:** `npm run build` green ✅ · `npx tsc --noEmit` 0 errors ✅ · `npm run check:i18n` parity ✅

| Step | Description | Status | Migration / File | Date |
|------|-------------|--------|-----------------|------|
| 1.1 | Migration 0344: Event Catalog Schema | ✅ DONE | `0344_ntf_catalog_schema.sql` | 2026-06-06 |
| 1.2 | Migration 0345: Event Catalog Seed (115 events, 27 cats) | ✅ DONE | `0345_ntf_catalog_seed.sql` | 2026-06-06 |
| 1.3 | Migration 0346: Provider Catalog + Template Schema + Phase 1 seeds | ✅ DONE | `0346_ntf_templates_schema.sql` | 2026-06-06 |
| 1.4 | Migration 0347: Tenant Settings + User Prefs | ✅ DONE | `0347_ntf_tenant_settings.sql` | 2026-06-06 |
| 1.5 | Migration 0348: Runtime Tables (inbox, outbox, delivery log) | ✅ DONE | `0348_ntf_runtime_tables.sql` | 2026-06-06 |
| 1.6 | Migration 0349: Permissions + Nav Dual-Write | ✅ DONE | `0349_ntf_permissions_and_nav.sql` | 2026-06-06 |
| 1.7 | Navigation frontend dual-write (navigation.ts) | ✅ DONE | `web-admin/config/navigation.ts` | 2026-06-06 |
| 1.8 | Notification Library (lib/notifications/) | ✅ DONE | `web-admin/lib/notifications/` | 2026-06-06 |
| 1.9 | API Routes (/api/notifications/*) | ✅ DONE | `web-admin/app/api/v1/notifications/` | 2026-06-06 |
| 1.10 | React Hooks (useNotificationBell, useNotifications) | ✅ DONE | `web-admin/src/features/notifications/hooks/` | 2026-06-06 |
| 1.11 | UI Components (Bell, Drawer, Center Page) | ✅ DONE | `web-admin/src/features/notifications/ui/` | 2026-06-06 |
| 1.12 | i18n Keys (EN + AR) | ✅ DONE | `messages/en.json`, `messages/ar.json` | 2026-06-06 |
| 1.13 | Wire 3 Order Events (created, ready, cancelled) | ✅ DONE | `app/api/v1/orders/route.ts` + `[id]/transition/route.ts` | 2026-06-06 |
| 1.14 | Build Validation + Phase 1 Close | ✅ DONE | build green · tsc 0 errors · i18n parity pass | 2026-06-06 |

---

## Phase 2 — Email + Preferences UI + Outbox Worker

**Status:** ⬜ NOT STARTED  
**Prerequisite:** Phase 1 complete

| Step | Description | Status | Notes |
|------|-------------|--------|-------|
| 2.0 | cleanmatexsaas: Provider Config API | ⬜ TODO | Needed before Step 2.3 |
| 2.1 | WhatsApp Template Pre-Submission to META | ⬜ TODO | See tracker below |
| 2.2 | Migration 0353: pg_cron + pg_net Outbox Worker | ⬜ TODO | — |
| 2.3 | Email Adapter (SendGrid) | ⬜ TODO | — |
| 2.4 | Outbox Processor API Route | ⬜ TODO | — |
| 2.5 | Quiet Hours + Marketing Consent Enforcement | ⬜ TODO | — |
| 2.6 | Preferences UI + Delivery Log Page | ⬜ TODO | — |
| 2.7 | Wire 30 Additional Order/Payment Events | ⬜ TODO | — |
| 2.8 | Build Validation + Phase 2 Close | ⬜ TODO | — |

---

## Phase 3 — WhatsApp + SMS + Push Notifications

**Status:** ⬜ NOT STARTED  
**Prerequisite:** Phase 2 complete + WhatsApp templates approved

| Step | Description | Status | Notes |
|------|-------------|--------|-------|
| 3.1 | Migration 0351: FCM Tokens Table | ⬜ TODO | — |
| 3.2 | FCM Token API Routes | ⬜ TODO | — |
| 3.3 | WhatsApp Adapter | ⬜ TODO | Needs META template approval |
| 3.4 | SMS Adapter | ⬜ TODO | — |
| 3.5 | Push Adapter (FCM v1) | ⬜ TODO | — |
| 3.6 | cleanmatexsaas: Quota API | ⬜ TODO | — |
| 3.7 | cleanmatexsaas: HQ Template Library UI | ⬜ TODO | — |
| 3.8 | Build Validation + Phase 3 Close | ⬜ TODO | — |

---

## Phase 4 — Campaign Engine

**Status:** ⬜ NOT STARTED  
**Prerequisite:** Phase 3 complete  
**Feature flag:** `campaign_notifications_enabled` (off by default)

| Step | Description | Status | Notes |
|------|-------------|--------|-------|
| 4.1 | Migration 0350: Campaign Tables | ⬜ TODO | — |
| 4.2 | Campaign API Routes | ⬜ TODO | — |
| 4.3 | Campaign Scheduler (pg_cron) | ⬜ TODO | — |
| 4.4 | Campaign UI | ⬜ TODO | — |
| 4.5 | cleanmatexsaas: Campaign Quota Limits | ⬜ TODO | — |
| 4.6 | Build Validation + Full MVP Close | ⬜ TODO | — |

---

## Applied Migrations Log

| Migration | File | Applied | Notes |
|-----------|------|---------|-------|
| 0344 | `0344_ntf_catalog_schema.sql` | 2026-06-06 | Creates sys_ntf_categories_cd, sys_ntf_events_cd, sys_ntf_event_chan_map; adds WEB_SOCKET channel |
| 0345 | `0345_ntf_catalog_seed.sql` | 2026-06-06 | 27 categories, 115 events, ~250 event-channel mappings (idempotent) |
| 0346 | `0346_ntf_templates_schema.sql` | 2026-06-06 | 6 providers, template tables, 3 Phase 1 IN_APP templates (order.created/ready/cancelled) APPROVED |
| 0347 | `0347_ntf_tenant_settings.sql` | 2026-06-06 | org_ntf_settings_cf, org_ntf_user_prefs_dtl; composite FK fix for org_branches_mst |
| 0348 | `0348_ntf_runtime_tables.sql` | 2026-06-06 | org_ntf_inbox_mst (Realtime enabled), org_ntf_outbox_dtl, org_ntf_delivery_log_dtl |
| 0349 | `0349_ntf_permissions_and_nav.sql` | ⏳ PENDING | 5 permissions + role assignments + 4 sys_components_cd rows (section + 3 pages) |

---

## WhatsApp Template Approval Tracker

> Submit to META Business Manager at Phase 2 start. Approval takes 1–3 business days.

| Template Name | Content (EN) | Submitted | Approved | META Template ID |
|---------------|--------------|-----------|----------|-----------------|
| `cmx_order_ready` | "Your order #{order_number} is ready for pickup at {branch_name}." | ⬜ | ⬜ | — |
| `cmx_order_cancelled` | "Your order #{order_number} has been cancelled." | ⬜ | ⬜ | — |
| `cmx_payment_received` | "Payment of {amount} {currency} received for order #{order_number}." | ⬜ | ⬜ | — |
| `cmx_payment_reminder` | "Reminder: payment of {amount} is pending for order #{order_number}." | ⬜ | ⬜ | — |
| `cmx_order_delayed` | "Your order #{order_number} is delayed. New ETA: {estimated_time}." | ⬜ | ⬜ | — |

---

## Blockers / Risks

| Item | Risk | Mitigation |
|------|------|-----------|
| WhatsApp templates | META approval can take 3–7 days | Submit at Phase 2 start, not Phase 3 start |
| pg_net/pg_cron | Must be enabled in Supabase project | Verify in Phase 2 before writing migration 0353 |
| cleanmatexsaas provider API | Email adapter depends on it | Build in parallel; stub locally for testing |
