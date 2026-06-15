# RESUME — Notification Hub: Next Steps

**Written:** 2026-06-15  
**For:** Next Claude session after `/clear`  
**Project:** CleanMateX (`F:\jhapp\cleanmatex`) + sibling `CleanMateX SaaS` (`F:\jhapp\cleanmatexsaas`)

---

## What was just completed

### cleanmatex — ALL phases done

| Item | Status | Migration(s) |
|---|---|---|
| Phase 1 — Schema + in-app | ✅ | 0344–0349 |
| Phase 2 — Email adapter + outbox | ✅ | 0350 |
| Phase 3 — SMS / WhatsApp / Push | ✅ | 0351–0356 |
| Frontend Track A — Bell, center, settings, delivery log | ✅ | — |
| Phase 4 — Campaign engine | ✅ | 0361–0363 |
| Documentation | ✅ | — |
| **Table naming unification** | ✅ | **0364** |

**Last migration applied:** `0364_ntf_unify_table_names.sql`  
**Next migration seq:** `0365`

### Naming unification (0364) summary
All 7 inconsistent notification tables renamed to `_ntf_` standard:

| Old | New |
|---|---|
| `org_notif_push_subs_dtl` | `org_ntf_push_subs_dtl` |
| `org_notif_campaign_targets_dtl` | `org_ntf_camp_targets_dtl` |
| `org_notification_campaigns_mst` | `org_ntf_campaigns_mst` |
| `org_notification_audit_dtl` | `org_ntf_audit_dtl` |
| `org_notification_usage_daily` | `org_ntf_usage_daily` |
| `sys_notification_channel_cd` | `sys_ntf_channel_cd` |
| `sys_notification_type_cd` | `sys_ntf_type_cd` |

9 indexes + 1 RLS policy renamed. Sweep function recreated. All TS files + Prisma + docs updated. Build green.

**Optional follow-up (low priority):** FK constraint names still carry old table names (e.g. `org_notification_campaigns_mst_tenant_org_id_fkey`). Cosmetic only — functionally correct. Can be cleaned via `ALTER TABLE ... RENAME CONSTRAINT` in migration 0365 if desired.

---

## What's next

### Primary: HQ Phases A/B/C in cleanmatexsaas

The HQ (Platform Console) work lives in `F:\jhapp\cleanmatexsaas`. Full plan at:
```
F:\jhapp\cleanmatex\docs\features\Notification_And_Communication_Hub\HQ_PHASES_PLAN.md
```

**Architecture decision (locked):**
- HQ = UI-only, direct Supabase service-role for simple CRUD on `sys_*` tables
- Operations with business logic (template approve, broadcast) call cleanmatex internal API routes
- cleanmatex must implement 2 internal API routes before HQ Phase B/C can be completed

#### Phase A — Provider & Runtime Config UI (cleanmatexsaas)
Direct Supabase service-role CRUD on:
- `sys_ntf_providers_cd` (provider catalog)
- `sys_ntf_runtime_cf` (runtime config per tenant)
- Read-only view of `org_ntf_channel_provider_cf` (per-tenant activation status)

No internal API calls needed for Phase A.

#### Phase B — Template Library UI (cleanmatexsaas)
- CRUD on `sys_notification_templates_mst` (template library)
- Template APPROVE action → calls `POST /api/platform/notifications/templates/:code/approve` on cleanmatex
- **Blocker:** cleanmatex needs to implement the approve route first

#### Phase C — Operations Center (cleanmatexsaas)
- Broadcast → calls `POST /api/v1/notifications/broadcasts` on cleanmatex
- Usage dashboard → reads `org_ntf_usage_daily`
- Provider health → reads `org_ntf_delivery_log_dtl`
- **Blocker:** cleanmatex needs to implement the broadcast route first

---

### cleanmatex — 2 internal API routes to build before Phase B/C

These routes must be built in cleanmatex BEFORE HQ can use them:

**Route 1: Template approve**
```
POST /api/platform/notifications/templates/:code/approve
Auth: CLEANMATEX_INTERNAL_API_SECRET (Bearer)
Body: { approved_by: string, approval_notes?: string }
Action: Update template status to APPROVED in sys_notification_templates_mst
```

**Route 2: Broadcast**
```
POST /api/v1/notifications/broadcasts
Auth: CLEANMATEX_INTERNAL_API_SECRET (Bearer)
Body: { tenant_org_id, channel_code, template_code, recipient_user_ids[], variables? }
Action: Fan-out via orchestrator to all recipients
```

---

### Secondary (optional, low priority)

| Item | Project | Notes |
|---|---|---|
| FK constraint name cleanup | cleanmatex | Migration 0365, optional cosmetic |
| WhatsApp META templates | External | 5 templates pending META approval |
| Campaign quota enforcement | cleanmatex | Blocked on cleanmatexsaas quota API |
| Payment Modal V3 | cleanmatex | Redesign of payment-modal-enhanced-02.tsx; plan at `docs/features/.../quizzical-cuddling-pizza.md` |

---

## Key files to reference

| File | Purpose |
|---|---|
| `docs/features/Notification_And_Communication_Hub/HQ_PHASES_PLAN.md` | Full HQ phase spec |
| `docs/features/Notification_And_Communication_Hub/PLAN.md` | cleanmatex phase specs |
| `docs/features/Notification_And_Communication_Hub/testing_scenarios.md` | Full test guide |
| `docs/features/Notification_And_Communication_Hub/developer_guide.md` | Architecture reference |
| `web-admin/lib/notifications/orchestrator.ts` | Core dispatch logic |
| `web-admin/lib/notifications/settings-service.ts` | Channel/provider settings |

---

## Env vars needed in cleanmatexsaas

```
CLEANMATEX_SUPABASE_URL=<same as cleanmatex NEXT_PUBLIC_SUPABASE_URL>
CLEANMATEX_SUPABASE_SERVICE_ROLE_KEY=<cleanmatex service role key>
CLEANMATEX_INTERNAL_API_URL=<cleanmatex base URL, e.g. http://localhost:3000>
CLEANMATEX_INTERNAL_API_SECRET=<same value as NOTIFICATIONS_OUTBOX_SECRET in cleanmatex>
```

---

## How to resume in the next session

Start the new session with:

> **"Load `docs/features/Notification_And_Communication_Hub/RESUME_ntf_next_steps.md` and continue from there. Next task is HQ Phase A in cleanmatexsaas."**

Then load:
- `/frontend` skill (for UI components in cleanmatexsaas)
- `/backend` skill (for the 2 cleanmatex internal routes)
- `/database` skill (if any migrations needed)
