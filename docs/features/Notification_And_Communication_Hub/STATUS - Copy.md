# CMX-PRD-019 — Notification Hub: Status

**Project:** CleanMateX Notification & Communication Hub
**PRD:** CMX-PRD-019
**Last Updated:** 2026-06-12
**Overall Status:** ✅ cleanmatex MVP COMPLETE — HQ phases pending in cleanmatexsaas

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
| HQ Phase A — Template Mgmt | ⏳ Not started | — | cleanmatexsaas project |
| HQ Phase B — Provider Config API | ⏳ Not started | — | cleanmatexsaas project |
| HQ Phase C — Broadcast Center | ⏳ Not started | — | cleanmatexsaas project |

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
2. HQ Phase A (cleanmatexsaas) — Template Library UI
3. HQ Phase B (cleanmatexsaas) — Provider Config API
4. HQ Phase C (cleanmatexsaas) — Broadcast Center
5. Campaign quota enforcement — integrate cleanmatexsaas quota API in process-campaigns route
6. Event wiring — wire remaining order/payment events from the event catalog (see PLAN.md Step 2.7)
