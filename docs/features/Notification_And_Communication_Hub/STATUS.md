# Current production enhancement status — 2026-10-09

**Authority:** The dated entries below are historical delivery records. The current implementation authority is [notification-hub-production-implementation-plan.md](./notification-hub-production-implementation-plan.md) and its schema/contract companion.

- [x] Shared schema applied through `0593_ntf_private_account_credentials.sql`; the operator regenerated database types and tenant Prisma after each applied migration.
- [x] Migration `0583_ntf_route_private_account_nullable.sql` is applied; `platform_account_id` is nullable so valid PRIVATE routes can be created.
- [x] P1 durable dispatch/receipt safety and P2 platform provider-account, sender, localized-contract, provider-registration, route-assignment, and private-resource foundations are implemented.
- [x] HQ route administration: tenant-scoped create, optimistic draft edit, activate, suspend, and retire APIs use canonical HQ permissions, audit logs, ownership-branch validation, and approved account/sender/template/locale/binding checks for platform and private routes.
- [x] HQ provider-template registration discovery APIs expose redacted platform registrations and immutable revision metadata for route configuration.
- [x] Migration `0586_ntf_platform_template_import_command.sql` is applied. It provides the service-role-only atomic persistence boundary for authenticated platform provider-template imports.
- [x] HQ can import a selected Twilio WhatsApp Content SID through a server-only authenticated connector. The request contains only resource selectors; the connector fetches the Content and approval records, then persists the redacted observation through `0586`.
- [x] HQ Providers includes the bilingual controlled Twilio import form, backed by redacted verified account/sender/locale candidates; the platform API module imports `AuditModule` so deployment can resolve its audit dependency.
- [x] The Twilio importer now preserves connector-derived ordered slot evidence in its JSON snapshot; the generated Supabase JSON boundary compiles cleanly, and focused importer tests cover repeated positional placeholders and slot evidence.
- [x] Migration `0588_ntf_platform_template_binding_command.sql` is applied. HQ exposes revision-scoped binding candidates and an immutable binding-definition command; the Providers screen now supports registration/revision review and ordered slot mapping before the one-time command is submitted.
- [x] HQ can refresh the current Twilio provider revision through a managed confirmation flow. The server re-fetches the stored Content SID using the verified account, creates a fresh immutable revision, advances the current pointer atomically, and requires the new revision to be mapped before use.
- [x] Migration `0592_ntf_private_template_import_command.sql` is applied and generated database types are available. It provides `cmx_import_org_ntf_prov_tmpl`, an atomic service-role-only tenant-private WhatsApp import command with direct tenant predicates and account/sender/locale validation.
- [x] Migration `0593_ntf_private_account_credentials.sql` is applied. HQ private Twilio import decrypts only the selected tenant account envelope, validates its Account SID against `external_account_id`, and invokes the tenant-scoped 0592 command without exposing credentials.
- [x] HQ exposes redacted tenant-private registration and revision discovery under the provider-template resource. Both database reads include direct tenant predicates and exclude encrypted envelopes, provider snapshots, and approval evidence.
- [x] Migration `0596_ntf_private_template_binding_command.sql` is applied and generated types are available. It atomically defines a complete tenant-private immutable binding set with direct tenant predicates and service-role-only execution.
- [ ] Provider/tenant management APIs, UI workflows, dispatch resolver integration, consent/suppression enforcement, reconciliation, operational runbooks, and pilot evidence remain required before production rollout.

---
# CMX-PRD-019 — Notification Hub: Status

**Project:** CleanMateX Notification & Communication Hub
**PRD:** CMX-PRD-019
**Last Updated:** 2026-10-03
**Overall Status:** P1 legacy-transport safety implemented; P2–P7 remain pending.

## 2026-10-03 — P1/M1 durable legacy dispatch safety

- [x] User applied shared migration `0556_ntf_outbox_claim_safety.sql` to local and remote databases, then regenerated tenant and HQ database types and tenant Prisma.
- [x] Tenant outbox workers now acquire tenant-scoped claim tokens and leases, conditionally finalize only their own claim, append immutable attempt logs, and hold thrown provider calls as `ACCEPTANCE_UNCERTAIN` rather than resend them.
- [x] Optional inline WhatsApp dispatch now uses the same durable claim/finalization rules and no longer bypasses the outbox safety boundary.
- [x] HQ reserves `hq_ntf_dispatch_log` as `PENDING` before provider submission, returns a matched concurrent command rather than duplicate-send, and rejects incomplete BYO routes instead of using platform credentials.
- [x] HQ preserves raw callback bytes for signature verification, rejects invalid callbacks before persistence, validates Twilio form callbacks against the configured callback URL, and scopes provider-status projection to compatible provider codes.
- [x] Focused tenant and HQ suites pass; tenant production build passes.

**Required HQ configuration before Twilio callback activation:** set `HQ_TWILIO_WEBHOOK_URL` to the exact HTTPS callback URL registered in Twilio. The P1 verifier rejects Twilio callbacks when this value is absent or differs from Twilio's signed URL.

**Still pending:** M1-B append-only acceptance/receipt correlation schema, durable receipt projection, provider account/sender/template revisions, typed variables/collections, route assignments, HQ and tenant administration UX, quota reservations, campaigns hardening, pilot evidence, and production rollout gates.

No billing, plan, feature-flag, navigation, permission, or external-send behavior was enabled by this increment. Deployment and live provider callback verification remain operator-controlled.

## 2026-10-03 — Production architecture implementation planning

- [x] Created the [canonical production implementation plan](./notification-hub-production-implementation-plan.md) covering both repositories, shared schema, services/APIs, provider transport, HQ/tenant UI, security, tests and rollout.
- [x] Created the supporting [schema and contract specification](./notification-hub-schema-and-contracts.md), including platform/private ownership, localized/provider revisions, typed collections/calculations and delivery evidence.
- [ ] Review the proposed implementation slices and schema/API decisions.
- [ ] Implement and verify phases P0–P7; all enhancement implementation remains pending.

This increment changes documentation only. Historical completion labels below do not establish production readiness for the proposed enhancements. No code, SQL, migration application, deployment, provider configuration or external send was performed.

---

## 2026-10-02 — Direct Twilio production templates and operator UI

- [x] Per-event Content SID/maps, production recipient/consent checks, tenant-safe retries and dispatch claims.
- [x] Existing Notification Settings template editor and customer Preferences consent control (EN/AR).
- [x] Existing permission/API access contracts; no schema, migration, navigation, or permission additions.
- [x] [Operator setup and order-created test runbook](Setup_And_Config/14_twilio_production_order_created.md).
- [ ] Deployment, tenant configuration, and live CleanMateX order-created delivery verification.

The approved template's direct Twilio test succeeded per the operator. Repository changes
do not establish deployment, active tenant configuration, or live order-created delivery.

Validation for this increment: 133 targeted tests across 13 suites, production build, full ESLint, EN/AR catalog parity,
scoped access-contract checks, and platform-inventory validation passed. Standalone
typecheck remains blocked by existing FX BigInt/ES2017 errors and the missing required
subscription currency in `lib/services/tenants.service.ts`; no notification-scope errors
remain. The existing build configuration skips TypeScript errors. Storybook stories
lint clean, but its build attempt exited with native code 3221226356 without a source
diagnostic. Live browser and external delivery checks remain pending.

---

## Phase Summary

| Phase | Status | Completed | Notes |
|-------|--------|-----------|-------|
| Exploration | ✅ COMPLETE | 2026-06-06 | Architecture + roadmap locked |
| Phase 1 — Foundation + In-App | ✅ COMPLETE | 2026-06-11 | Migs 0344–0349; bell UI live |
| Phase 2 — Email + Outbox Worker | ✅ COMPLETE | 2026-06-11 | Mig 0350; outbox pg_cron live |
| Phase 3 — WhatsApp + SMS + Push | ✅ COMPLETE | 2026-06-12 | Migs 0351–0356; all channel adapters wired |
| Frontend — Bell UI (Track A) | ✅ COMPLETE | 2026-06-12 | Bell, drawer, center page, prefs page |
| Phase 4 — Campaign Engine | ✅ COMPLETE | 2026-06-12 | Migs 0361–0363; campaign CRUD + UI + scheduler |
| HQ Phase B0 — Guards, Encryption, Audit | ✅ COMPLETE | 2026-06-16 | cleanmatexsaas: JwtAuthGuard, AES-256-GCM, AuditService |
| HQ Phase B1 — EMAIL Dispatch Proxy | ✅ COMPLETE | 2026-06-16 | cleanmatexsaas: GovernanceService, EMAIL provider send |
| HQ Phase B2 — Quota & Pricing | ✅ COMPLETE | 2026-06-16 | cleanmatexsaas: QuotaService, PricingService, MeteringService |
| HQ Phase B3 — SMS / WA / Push + Workers | ✅ COMPLETE | 2026-06-16 | cleanmatexsaas: BullMQ workers, all 4 channel providers |
| HQ Phase BYO — Encrypted BYO Credentials | ✅ COMPLETE | 2026-06-16 | cleanmatexsaas: AES-GCM per-tenant cred encryption |
| HQ Phase A — Template Library UI | ✅ COMPLETE | 2026-06-16 | cleanmatexsaas: DRAFT→APPROVED→RETIRED state machine |
| HQ Phase C — Observability + Broadcast | ✅ COMPLETE | 2026-06-16 | cleanmatexsaas: dashboards, campaign CRUD |
| HQ Phase X — Hardening | ✅ COMPLETE | 2026-06-16 | cleanmatexsaas: throttle, _stripSecrets, ADR-002 |

---

## Phase 1 — Foundation + In-App ✅

**Completed:** 2026-06-11

### Migrations Applied

| Migration | Status | Date |
|-----------|--------|------|
| 0344 — notif_catalog_schema | ✅ Applied | 2026-06-09 |
| 0345 — notif_catalog_seed | ✅ Applied | 2026-06-09 |
| 0346 — notif_templates_schema | ✅ Applied | 2026-06-09 |
| 0347 — notif_tenant_settings | ✅ Applied | 2026-06-09 |
| 0348 — notif_runtime_tables | ✅ Applied | 2026-06-09 |
| 0349 — ntf_permissions_and_nav | ✅ Applied | 2026-06-09 |

### Deliverables

- [x] Event catalog schema (27 categories, 116 events)
- [x] Template schema (providers, templates, versions, channels)
- [x] Tenant channel settings + user preferences tables
- [x] Runtime tables: org_notifications_mst, org_notification_outbox_dtl, org_notif_delivery_log_dtl
- [x] Supabase Realtime enabled on org_notifications_mst
- [x] Permissions seeded: notifications:read/manage/view_log/configure/send_test
- [x] Navigation entries seeded in sys_components_cd
- [x] IN_APP adapter, outbox adapter, orchestrator, event emitter
- [x] Notification bell — real-time badge via Supabase Realtime
- [x] Notification center page — tabs, pagination, mark-read
- [x] 3 order events wired: order.created, order.ready, order.cancelled
- [x] i18n keys (EN + AR) — npm run check:i18n green
- [x] npm run build green

---

## Phase 2 — Email + Outbox Worker ✅

**Completed:** 2026-06-11

### Migrations Applied

| Migration | Status | Date |
|-----------|--------|------|
| 0350 — ntf_outbox_cron | ✅ Applied | 2026-06-11 |

### Deliverables

- [x] pg_cron outbox processor job registered (every 1 min)
- [x] pg_cron retry sweep job registered (every 5 min)
- [x] /api/notifications/process-outbox route — Bearer-authenticated
- [x] Email adapter (Resend provider)
- [x] Outbox processor: dispatches to correct adapter by channel_code
- [x] Quiet hours enforcement in orchestrator
- [x] Marketing consent check in orchestrator
- [x] Notification preferences API: GET/PUT /api/v1/notifications/preferences
- [x] Notification settings API: GET/PUT /api/v1/notifications/settings

---

## Phase 3 — WhatsApp + SMS + Push ✅

**Completed:** 2026-06-12

### Migrations Applied

| Migration | Status | Date |
|-----------|--------|------|
| 0351 — notif_push_subscriptions | ✅ Applied | 2026-06-12 |
| 0352 — notif_channel_provider_cf | ✅ Applied | 2026-06-12 |
| 0353 — notif_push_sweep_cron | ✅ Applied | 2026-06-12 |
| 0355 — ntf_config_table_cron_fix | ✅ Applied | 2026-06-12 |
| 0356 — ntf_provider_cf_is_enabled | ✅ Applied | 2026-06-12 |

### Deliverables

- [x] org_ntf_push_subs_dtl + org_ntf_channel_provider_cf tables
- [x] sys_ntf_runtime_cf — runtime config key/value (GUC workaround)
- [x] SECURITY DEFINER ntf_trigger_outbox_proc() function
- [x] Settings service singleton with 30s cache
- [x] Push subscription management API
- [x] Provider management API (GET/POST/PUT/DELETE)
- [x] WhatsApp, SMS, Push adapters
- [x] VAPID service worker (public/sw.js) + push client library
- [x] Channel Settings UI + Delivery Log page
- [x] Provider activation run for all tenants

### WhatsApp Template Approval

| Template | Status |
|----------|--------|
| cmx_order_ready | ⏳ Pending META approval |
| cmx_order_cancelled | ⏳ Pending META approval |
| cmx_payment_received | ⏳ Pending META approval |
| cmx_payment_reminder | ⏳ Pending META approval |
| cmx_order_delayed | ⏳ Pending META approval |

---

## Phase 4 — Campaign Engine ✅

**Completed:** 2026-06-12

### Migrations Applied

| Migration | Status | Date |
|-----------|--------|------|
| 0361 — ntf_campaign_engine_tables | ✅ Applied | 2026-06-12 |
| 0362 — ntf_campaign_scheduler_cron | ✅ Applied | 2026-06-12 |
| 0363 — nav_marketing_campaigns | ✅ Applied | 2026-06-12 |

### Deliverables

- [x] Campaign tables: org_ntf_campaigns_mst, org_ntf_camp_targets_dtl, org_ntf_usage_daily, org_ntf_audit_dtl
- [x] Campaign state machine: DRAFT → PENDING_APPROVAL → APPROVED → SCHEDULED → RUNNING → COMPLETED
- [x] Full campaign CRUD API (list/create/detail/status/test)
- [x] ntf_trigger_campaign_proc() SECURITY DEFINER + ntf-campaign-scheduler pg_cron job (every 1 min)
- [x] /api/notifications/process-campaigns — Phase A: activate + create targets; Phase B: consent-gate + dispatch
- [x] Campaign list page, create form, detail page (Cmx components, RTL-aware)
- [x] Routes: /dashboard/marketing/campaigns + /dashboard/marketing/campaigns/[id]
- [x] Navigation entry marketing_campaigns (gated by campaigns_enabled flag)
- [x] i18n notifications.campaigns.* keys (EN + AR)
- [x] npm run build green + npm run check:i18n green

### Pending (cleanmatexsaas)

- [ ] Campaign quota limits per plan tier (Free=0, Starter=2, Pro=20, Enterprise=unlimited)
- [ ] HQ campaign quota dashboard

---

## Migration Manifest (complete, cleanmatex)

| Seq | File | Phase |
|-----|------|-------|
| 0344 | notif_catalog_schema | 1 |
| 0345 | notif_catalog_seed | 1 |
| 0346 | notif_templates_schema | 1 |
| 0347 | notif_tenant_settings | 1 |
| 0348 | notif_runtime_tables | 1 |
| 0349 | ntf_permissions_and_nav | 1 |
| 0350 | ntf_outbox_cron | 2 |
| 0351 | notif_push_subscriptions | 3 |
| 0352 | notif_channel_provider_cf | 3 |
| 0353 | notif_push_sweep_cron | 3 |
| 0355 | ntf_config_table_cron_fix | 3 |
| 0356 | ntf_provider_cf_is_enabled | 3 |
| 0361 | ntf_campaign_engine_tables | 4 |
| 0362 | ntf_campaign_scheduler_cron | 4 |
| 0363 | nav_marketing_campaigns | 4 |
| 0364 | ntf_table_naming_unification | HQ-prep |
| 0365 | hq_audit_logs_improve | HQ-B0 |
| 0366 | ntf_dispatch_mode_currency | HQ-B0 |
| 0367 | hq_ntf_dispatch_log | HQ-B1 |
| 0369 | sys_ntf_quota_plan_cf | HQ-B2 |
| 0370 | org_ntf_quota_override_cf | HQ-B2 |
| 0371 | sys_ntf_pricing_cf | HQ-B2 |
| 0373 | hq_ntf_webhook_events | HQ-B3 |

---

## Permissions Reference

| Code | Purpose | Roles |
|------|---------|-------|
| notifications:read | View own notifications (bell, center) | All roles |
| notifications:manage | Mark read, manage prefs, campaign ops | admin, tenant_admin, super_admin |
| notifications:view_log | View delivery log | admin, tenant_admin, super_admin |
| notifications:configure | Manage tenant channel settings | admin, tenant_admin, super_admin |
| notifications:send_test | Send test notification | admin, tenant_admin, super_admin |

---

## Environment Variables Required

```
NOTIFICATIONS_OUTBOX_SECRET=<32+ char random string>
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<VAPID public key>
VAPID_PRIVATE_KEY=<VAPID private key>
RESEND_API_KEY=<Resend API key>
TWILIO_ACCOUNT_SID=<Twilio SID>
TWILIO_AUTH_TOKEN=<Twilio auth token>
```

---

## Feature Flags

| Flag Code | Default | Governs |
|-----------|---------|---------|
| notifications_enabled | false | Entire hub |
| email_notifications_enabled | false | Email channel |
| sms_notifications_enabled | false | SMS channel |
| whatsapp_notifications_enabled | false | WhatsApp channel |
| push_notifications_enabled | false | Push channel |
| campaigns_enabled | false | Campaign Engine |

---

## Next Steps

1. META WhatsApp template approval — update template IDs above when received
2. Campaign quota enforcement — integrate cleanmatexsaas quota API in `process-campaigns` route (HQ-B2 gate endpoint ready)
3. Event wiring — wire remaining order/payment events from the event catalog (see PLAN.md Step 2.7)
4. Run `scripts/dev/update-types.ps1` in cleanmatexsaas to regenerate types for 0366 columns

---

## HQ Phases (cleanmatexsaas) — ALL COMPLETE as of 2026-06-16

All HQ phases were implemented in `F:\jhapp\cleanmatexsaas`. The architecture decision was revised from "management UI only" to a **single-egress HQ dispatch proxy** (ADR-002): all external sends (EMAIL/SMS/WA/PUSH) route through `platform-api`; cleanmatex holds zero provider secrets.

| HQ Phase | Scope | Status | Date |
|----------|-------|--------|------|
| B0 | JwtAuthGuard, AES-256-GCM encryption, AuditService | ✅ COMPLETE | 2026-06-16 |
| B1 | EMAIL dispatch proxy, GovernanceService, provider credential UI | ✅ COMPLETE | 2026-06-16 |
| B2 | QuotaService, PricingService, MeteringService, dispatch gate | ✅ COMPLETE | 2026-06-16 |
| B3 | SMS/WA/Push providers, BullMQ workers, webhook ingestion | ✅ COMPLETE | 2026-06-16 |
| BYO | Encrypted bring-your-own credentials (AES-GCM, per-tenant) | ✅ COMPLETE | 2026-06-16 |
| A | Template library: DRAFT→APPROVED→RETIRED UI in platform-web | ✅ COMPLETE | 2026-06-16 |
| C | Observability dashboard + Broadcast Center UI | ✅ COMPLETE | 2026-06-16 |
| X | Throttle on webhooks, `_stripSecrets` pattern, ADR-002 | ✅ COMPLETE | 2026-06-16 |

**HQ env vars required** (in `platform-api/.env`):
```
HQ_ENCRYPTION_MASTER_KEY=<32-byte hex>
NTF_DISPATCH_VIA_HQ=true
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
META_WHATSAPP_TOKEN=...
FCM_SERVICE_ACCOUNT_JSON=...
```

**See:** `F:\jhapp\cleanmatexsaas\docs\dev\features_notification_hub_hq\` for full HQ documentation.

---

## 2026-06-15 — Table Naming Unification (migration 0364)

**Status:** COMPLETE

### What changed

All 7 notification tables with inconsistent abbreviations renamed to the `_ntf_` standard:

| Old name | New name |
|---|---|
| `org_notif_push_subs_dtl` | `org_ntf_push_subs_dtl` |
| `org_notif_campaign_targets_dtl` | `org_ntf_camp_targets_dtl` |
| `org_notification_campaigns_mst` | `org_ntf_campaigns_mst` |
| `org_notification_audit_dtl` | `org_ntf_audit_dtl` |
| `org_notification_usage_daily` | `org_ntf_usage_daily` |
| `sys_notification_channel_cd` | `sys_ntf_channel_cd` |
| `sys_notification_type_cd` | `sys_ntf_type_cd` |

9 indexes and 1 RLS policy also renamed. Sweep function recreated.
All TypeScript string literals updated. Prisma schema updated. Build green.

**Next migration seq:** 0365
