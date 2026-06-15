# CMX-PRD-019 — Notification Hub: HQ Phases Plan
# cleanmatexsaas Management UI Implementation Guide

**Parent plan:** [PLAN.md](./PLAN.md) — cleanmatex MVP (Phases 1–4) ✅ COMPLETE  
**Roadmap:** [ROADMAP.md](./ROADMAP.md)  
**Implementation project:** `F:\jhapp\cleanmatexsaas`  
**Migrations owner:** `F:\jhapp\cleanmatex` — cleanmatexsaas NEVER creates migrations  
**Created:** 2026-06-13  
**Last Updated:** 2026-06-13  

---

## Architecture Decision (Locked)

**cleanmatex owns ALL runtime logic.** It reads its own `sys_*` tables and env vars directly at dispatch time — no cross-project HTTP call at runtime.

**cleanmatexsaas HQ is a management console only.** Its job is to fill and maintain the `sys_*` catalog tables in cleanmatex DB via service-role Supabase client. No new runtime APIs needed in cleanmatexsaas.

```
Runtime (cleanmatex):
  orchestrator → reads sys_ntf_providers_cd   (which provider is active)
              → reads sys_ntf_runtime_cf      (non-secret config, base URLs)
              → reads env vars                (API secrets — never in DB)
              → reads sys_notification_templates_mst  (template content)

Management (cleanmatexsaas HQ UI):
  Admin fills sys_ntf_providers_cd            → cleanmatex uses it immediately
  Admin manages sys_notification_templates_mst → cleanmatex renders from it
  Admin views org_ntf_usage_daily    → read-only quota dashboard
  Admin sends broadcast → calls cleanmatex    POST /api/v1/notifications/broadcasts
```

**Provider secrets** (SENDGRID_API_KEY, TWILIO_AUTH_TOKEN, etc.) stay in cleanmatex `.env.local`. HQ never sees or manages them — that's deployment-level config, not app-level.

---

## Prerequisites (All Complete)

| Prerequisite | Status |
|---|---|
| cleanmatex Phases 1–4 | ✅ DONE (2026-06-12) |
| `sys_ntf_providers_cd` seeded | ✅ DONE (mig 0346) |
| `sys_ntf_runtime_cf` table | ✅ DONE (mig 0355) |
| `sys_notification_templates_mst` | ✅ DONE (mig 0346) |
| `org_ntf_usage_daily` | ✅ DONE (mig 0361) |
| `org_ntf_channel_provider_cf` | ✅ DONE (mig 0352) |
| All migrations 0344–0363 applied | ✅ DONE |

---

## HOW TO USE THIS PLAN

- Load skills before writing: `/frontend` for HQ UI, `/backend` for any new cleanmatex routes.
- All reads/writes to cleanmatex DB: use **service-role Supabase client** in cleanmatexsaas.
- If a DB schema change is needed → create `.sql` file in `F:\jhapp\cleanmatex\supabase\migrations\`, STOP, and wait for user to apply.
- After every phase: update the Status table at the bottom of this file + update ROADMAP.md.

---

## HQ Permissions (cleanmatexsaas — its own permission system)

| Permission Code | Purpose |
|---|---|
| `hq_notifications:read` | View dashboards, delivery log |
| `hq_notifications:manage` | Manage templates, approve versions |
| `hq_notifications:broadcast` | Send system-wide announcements |
| `hq_notif_providers:manage` | Edit provider catalog + runtime config |
| `hq_notif_quota:read` | View tenant usage |
| `hq_notif_quota:manage` | Adjust per-tenant plan limits |

---

## cleanmatex Additions Required

Only one new thing needed in cleanmatex before Phase C:

### New Route — `POST /api/v1/notifications/broadcasts`

**File:** `web-admin/app/api/v1/notifications/broadcasts/route.ts`  
**Auth:** Service-role bearer token only (not tenant JWT)  
**Purpose:** HQ calls this to fan-out a system-wide IN_APP notification to all targeted tenants.

```typescript
// Request body
{
  title:        string   // EN
  title2:       string   // AR
  body:         string   // EN
  body2:        string   // AR
  priority:     'LOW' | 'NORMAL' | 'HIGH' | 'URGENT' | 'CRITICAL'
  target:       'all_tenants' | { plan_code: string } | { tenant_ids: string[] }
  scheduled_at?: string  // ISO timestamp; null = immediate
}
```

- Resolves `tenant_ids` from target, then for each tenant queries active user IDs and writes to `org_notifications_mst`
- `idempotency_key` pattern: `hq_broadcast:{broadcast_uuid}:{tenant_id}`
- Channel: IN_APP only
- Returns `{ broadcast_id, tenant_count, recipient_count }`

**Create this in cleanmatex before starting Phase C.**

---

## Phase A — Provider & Runtime Config UI

**Goal:** HQ admins can view and manage the global provider catalog and runtime config entries that cleanmatex reads at dispatch time.  
**Duration:** ~1 week  
**Gate:** Admin can add/edit a provider record in `sys_ntf_providers_cd` via HQ UI and see cleanmatex pick it up.  
**Priority:** Start here — simplest phase, unblocks Phase B.

---

### Step A.1 — Service-Role Supabase Client

**Skills to load first:** `/backend`  
**Path:** `platform-web/src/lib/supabase/cleanmatex-admin.ts` (or equivalent)

Tasks:
- [ ] Create a Supabase service-role client that connects to the **cleanmatex** Supabase instance
- [ ] Env vars: `CLEANMATEX_SUPABASE_URL`, `CLEANMATEX_SUPABASE_SERVICE_ROLE_KEY`
- [ ] Export typed client using cleanmatex's `database.ts` types (copy or reference)
- [ ] Never expose this client to the browser — server-only
- [ ] Update STATUS table: mark Step A.1 done

---

### Step A.2 — Provider Catalog UI

**Skills to load first:** `/frontend` + `/i18n`  
**Path:** `platform-web/src/features/notifications-hq/provider-catalog/`  
**Reads/writes:** `sys_ntf_providers_cd` via service-role client

Pages/components:
- [ ] Provider list page: table of all providers (code, name, channel, is_active, api_endpoint)
- [ ] Provider add/edit form: bilingual fields (name, name2), channel_code, api_endpoint, is_active toggle
- [ ] Soft-delete: sets `is_active = false` (no DELETE)
- [ ] Guard: `hq_notif_providers:manage`
- [ ] Update STATUS table: mark Step A.2 done

---

### Step A.3 — Runtime Config UI

**Skills to load first:** `/frontend` + `/i18n`  
**Path:** `platform-web/src/features/notifications-hq/runtime-config/`  
**Reads/writes:** `sys_ntf_runtime_cf` via service-role client

Pages/components:
- [ ] Config key/value table: shows all `sys_ntf_runtime_cf` rows
- [ ] Inline edit: click a value → edit in place → save (updates `updated_at`)
- [ ] Add new key row
- [ ] NO secrets stored here — remind admin in UI: "API keys go in deployment env vars"
- [ ] Guard: `hq_notif_providers:manage`
- [ ] Update STATUS table: mark Step A.3 done

---

### Step A.4 — Tenant Provider Activation View (Read-Only)

**Skills to load first:** `/frontend`  
**Reads:** `org_ntf_channel_provider_cf` via service-role client (read-only — tenant manages their own)

Pages/components:
- [ ] Grid view: tenants × channels → which provider is active per tenant per channel
- [ ] Filter by tenant, channel, is_active
- [ ] Guard: `hq_notif_quota:read`
- [ ] Update STATUS table: mark Step A.4 done

---

### Step A.5 — Build Validation & Phase A Close

- [ ] `npm run build` (cleanmatexsaas) — green
- [ ] **Update ROADMAP.md HQ Phase A status → ✅ COMPLETE**
- [ ] **Update STATUS table → Phase A COMPLETE with date**

---

## Phase B — Template Library UI

**Goal:** HQ admins can create, version, and approve notification templates that cleanmatex uses for rendering outgoing messages.  
**Duration:** ~2 weeks  
**Gate:** Template approved in HQ → cleanmatex reads it from `sys_notification_templates_mst` in the next dispatch.  
**Prerequisite:** Phase A complete (service-role client in place).

---

### Step B.1 — Template CRUD UI

**Skills to load first:** `/frontend` + `/i18n`  
**Path:** `platform-web/src/features/notifications-hq/template-library/`  
**Reads/writes:** `sys_notification_templates_mst` via service-role client

Pages/components:
- [ ] Template list: filter by channel_code, event_code, is_active; search by template_code or name
- [ ] Template create form:
  - `template_code` (unique key — validate uniqueness against DB)
  - `event_code` (dropdown from `sys_notification_events_cd`)
  - `name` / `name2` (bilingual)
  - `description` / `description2` (bilingual)
  - `is_system` toggle
- [ ] Template edit: same fields; cannot change `template_code` after creation
- [ ] Soft-delete: sets `is_active = false`
- [ ] Guard: `hq_notifications:manage`
- [ ] Update STATUS table: mark Step B.1 done

---

### Step B.2 — Template Version Management

**Skills to load first:** `/frontend` + `/i18n`  
**Reads/writes:** `sys_notif_template_ver_dtl`, `sys_notif_template_chan_dtl` via service-role client

Version state machine: `DRAFT → APPROVED → RETIRED`

Pages/components:
- [ ] Version list tab on template detail page: timeline of versions, status badge, created_by, approved_by
- [ ] Version create: creates DRAFT with `subject`/`subject2`, `body`/`body2`
- [ ] Version editor: richtext or textarea; bilingual side-by-side (EN left, AR right with `dir="rtl"`)
- [ ] Per-channel preview pane: shows how message renders for EMAIL / SMS / WhatsApp / PUSH (character limits, truncation indicators)
- [ ] Approve action: `DRAFT → APPROVED`; sets `approved_by`, `approved_at`; auto-retires previous APPROVED version
- [ ] Retire action: `APPROVED → RETIRED`
- [ ] Only `hq_notifications:manage` can approve/retire
- [ ] Update STATUS table: mark Step B.2 done

---

### Step B.3 — Per-Channel Rendering Records

**Skills to load first:** `/frontend` + `/backend`  
**Reads/writes:** `sys_notif_template_chan_dtl` via service-role client

Tasks:
- [ ] On approve: write rendered variants to `sys_notif_template_chan_dtl` for each supported channel
- [ ] Channel-specific rendering rules:
  - EMAIL: `rendered_subject` = subject (with variable placeholders preserved), `rendered_body` = full HTML/markdown body
  - SMS: `rendered_body` = truncated to 160 chars; warn if over limit
  - WHATSAPP: `rendered_body` = approved META template name only (not free-text)
  - PUSH: `rendered_subject` = title (50 char max), `rendered_body` = body (100 char max)
- [ ] Server-side rendering on approve (not browser-side)
- [ ] Update STATUS table: mark Step B.3 done

---

### Step B.4 — Build Validation & Phase B Close

- [ ] `npm run build` (cleanmatexsaas) — green
- [ ] Integration test: create template → approve → verify row in cleanmatex `sys_notification_templates_mst`
- [ ] **Update ROADMAP.md HQ Phase B status → ✅ COMPLETE**
- [ ] **Update STATUS table → Phase B COMPLETE with date**
- [ ] Run `/documentation` skill: update developer_guide, admin_guide

---

## Phase C — Operations Center

**Goal:** HQ admins can send system broadcasts, view cross-tenant usage dashboards, and monitor provider health.  
**Duration:** ~2 weeks  
**Gate:** Admin sends broadcast from HQ UI → targeted tenants see it in their notification bell within 30 seconds.  
**Prerequisite:** Phase B complete + cleanmatex `POST /api/v1/notifications/broadcasts` route created.

---

### Step C.1 — Broadcast Composer UI

**Skills to load first:** `/frontend` + `/i18n`  
**Path:** `platform-web/src/features/notifications-hq/broadcast-center/`  
**Calls:** cleanmatex `POST /api/v1/notifications/broadcasts` via service-role fetch

Pages/components:
- [ ] Broadcast compose page:
  - Bilingual title + body (EN/AR side-by-side)
  - Priority selector (`NORMAL` / `HIGH` / `URGENT` / `CRITICAL`)
  - Target selector: All Tenants / By Plan / Specific Tenants (multi-select)
  - Optional `scheduled_at` datetime picker
- [ ] Preview pane: how message looks in notification bell
- [ ] Confirmation dialog: "Send to {N} tenants · estimated {M} recipients — confirm?"
- [ ] Submit → calls cleanmatex broadcast route; shows result toast (`{M} notifications queued`)
- [ ] Guard: `hq_notifications:broadcast`
- [ ] Update STATUS table: mark Step C.1 done

---

### Step C.2 — Broadcast History

**Skills to load first:** `/frontend`  
**Reads:** cleanmatex `org_ntf_audit_dtl` or a dedicated broadcasts log table via service-role client

Tasks:
- [ ] Broadcast list: history of past broadcasts, status (SENT / SCHEDULED / CANCELLED), target, sent_at
- [ ] Detail view: per-broadcast aggregate stats (`total_recipients`, `delivered`, `read`) — aggregate only, no per-tenant PII
- [ ] Cancel button for SCHEDULED broadcasts (calls cleanmatex cancel route or direct DB update)
- [ ] Guard: `hq_notif_quota:read`
- [ ] Update STATUS table: mark Step C.2 done

---

### Step C.3 — Usage & Quota Dashboard

**Skills to load first:** `/frontend`  
**Reads:** `org_ntf_usage_daily` via service-role client (read-only)

Pages/components:
- [ ] Cross-tenant usage table: tenant × channel → messages sent this month
- [ ] Plan limit overlays: show used/limit bar when plan limits are defined (seed in cleanmatex migration if not already in plan catalog)
- [ ] Time range filter: current month / last 30 days / custom range
- [ ] Export to CSV
- [ ] Guard: `hq_notif_quota:read`
- [ ] Update STATUS table: mark Step C.3 done

---

### Step C.4 — Provider Health Dashboard

**Skills to load first:** `/frontend`  
**Reads:** `org_notif_delivery_log_dtl` via service-role client (aggregate, no PII)

Pages/components:
- [ ] Per-provider success/failure rates — aggregate across all tenants
- [ ] Channel panes: EMAIL, SMS, WHATSAPP, PUSH
- [ ] Time filter: last 1h / 24h / 7d / 30d
- [ ] Red badge alert when failure rate > 10% in last hour
- [ ] Guard: `hq_notif_quota:read`
- [ ] Update STATUS table: mark Step C.4 done

---

### Step C.5 — Build Validation & Phase C Close

- [ ] `npm run build` (cleanmatexsaas) — green
- [ ] Integration test: broadcast sent → verify `org_notifications_mst` rows in cleanmatex DB
- [ ] **Update ROADMAP.md HQ Phase C status → ✅ COMPLETE**
- [ ] **Update STATUS table → Phase C COMPLETE with date**
- [ ] Run `/documentation` skill: update admin_guide, deploy_guide

---

## Cross-Phase: Campaign Quota Limits

**Context:** cleanmatex Phase 4 (Campaign Engine) is complete but per-plan campaign limits are not enforced yet.

Tasks:
- [ ] Check if plan limits exist in cleanmatex plan catalog (`sys_plans_mst` or equivalent)
- [ ] If not: create cleanmatex migration (next seq 0364) to seed default limits:
  - Free: 0 campaigns/month
  - Starter: 2 campaigns/month
  - Pro: 20 campaigns/month
  - Enterprise: unlimited
- [ ] cleanmatex `POST /api/v1/notifications/campaigns` reads limit from plan catalog and rejects with `CAMPAIGN_QUOTA_EXCEEDED` if at limit
- [ ] HQ quota dashboard (Step C.3) includes campaign usage row
- [ ] STOP after writing migration — wait for user to apply before wiring campaign check

---

## Environment Variables

### cleanmatexsaas (new)

| Variable | Purpose |
|---|---|
| `CLEANMATEX_SUPABASE_URL` | cleanmatex Supabase project URL |
| `CLEANMATEX_SUPABASE_SERVICE_ROLE_KEY` | Service-role key for cleanmatex DB (server-only, never in browser) |
| `CLEANMATEX_INTERNAL_API_URL` | cleanmatex web-admin base URL (for broadcast route calls) |
| `CLEANMATEX_INTERNAL_API_SECRET` | Bearer token for service-role calls to cleanmatex internal routes |

### cleanmatex (existing — no change)

Provider secrets (SENDGRID_API_KEY, TWILIO_*, META_*, VAPID_*, FCM_*) stay in cleanmatex `.env.local`. HQ never reads or manages them.

---

## What HQ Does NOT Do

| ❌ Not HQ's job | ✅ Who does it |
|---|---|
| Dispatch emails / SMS / push at runtime | cleanmatex orchestrator + adapters |
| Store provider API secrets | cleanmatex deployment env vars |
| Resolve recipients for order events | cleanmatex `recipient-resolver.ts` |
| Process outbox queue | cleanmatex pg_cron |
| Manage tenant-level preferences | Tenant admin via cleanmatex settings UI |

---

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Service-role key exposed to browser | All cleanmatex DB calls server-only; never pass `CLEANMATEX_SUPABASE_SERVICE_ROLE_KEY` to client components |
| HQ edits sys_* tables mid-dispatch causing inconsistency | `sys_*` reads are fast; acceptable eventual consistency. No locking needed for catalog reads. |
| Broadcast fan-out to large tenant base times out | cleanmatex broadcast route returns 202 immediately; fan-out runs async in background |
| Template approved in HQ but cleanmatex cache stale | cleanmatex template renderer reads DB directly per dispatch (no in-memory template cache yet). Add cache invalidation if needed later. |

---

## Status

| Phase | Status | Last Updated |
|---|---|---|
| Phase A — Provider & Runtime Config UI | ⏳ Not started | — |
| Phase B — Template Library UI | ⏳ Not started | — |
| Phase C — Operations Center | ⏳ Not started | — |
| Campaign Quota Limits | ⏳ Not started | — |
| cleanmatex broadcast route | ⏳ Not started | — |

---

## Related Documentation

| Doc | Location |
|---|---|
| cleanmatex MVP PLAN | [PLAN.md](./PLAN.md) |
| Feature Roadmap | [ROADMAP.md](./ROADMAP.md) |
| Integration Contracts | [docs/dev/rules/integration-contracts.md](../../dev/rules/integration-contracts.md) |
| Developer Guide | [developer_guide.md](./developer_guide.md) |
| Admin Guide | [admin_guide.md](./admin_guide.md) |
| Deploy Guide | [deploy_guide.md](./deploy_guide.md) |

---

*Plan version: 2.0 (revised 2026-06-13) | Architecture: HQ = management UI only; cleanmatex = full runtime | Start with Phase A*
