# 10 — Edge Cases, Risks, Writer Inventory, Discovery

**Status:** P0 correction pass · **Date:** 2026-07-24

## 1. Writer inventory (V1.0 exit: zero non-engine writers)

| Caller | Target |
|--------|--------|
| Prep complete / sorting write | `COMPLETE_PREPARATION` |
| POD / delivery finalize | `CONFIRM_DELIVERY` only |
| PATCH/bulk status / order-actions picker | Engine or admin-gated remove |
| ItemProcessing / batch-update auto-ready | `executeAction` |
| Public confirm-intake | `CONFIRM_PHYSICAL_INTAKE` |
| Cancel/return RPCs | Fin → engine |
| Split-order create | InitialStatusResolver + engine |

## 2. Discovery (blocks P1)

**Use remote DB** (`supabase_remote` MCP — read-only). Do not use local as production evidence.

Canonical runbook + results: [DISCOVERY_REMOTE.md](DISCOVERY_REMOTE.md)

- `status` vs `current_status` drift
- `sorting` / illegal statuses
- Confirm `org_domain_events_outbox` + `org_idempotency_keys` on remote
- Code already decides: **reuse** central outbox + idempotency (not feature-specific tables)

**P1 blocked until DISCOVERY_REMOTE.md results signed.**

## 3. Risks

- Scope creep back to Full Pack big-bang → reject; use ADR phases
- Mass rename → avoid
- Feature outbox duplication → reuse central
- Retail `closed` shortcut → forbidden
- Tenant graph editing → forbidden in V1.0

## 4. P7R delivery proof/audit risks

| Risk | Required control | Release implication |
|------|------------------|---------------------|
| Cross-tenant proof disclosure | Every order, stop, POD, and operator lookup filters by `tenant_org_id`; signed storage keys must match the requesting tenant and stop | Security defect; block rollout and investigate access logs |
| Permanent or public evidence URL | Keep the bucket private, return no object keys, create five-minute signed URLs only at the authorized read boundary | Never make storage public as a workaround |
| Stale/expired evidence link | The audit card refreshes the read model and obtains new links without persisting them | Support can request refresh; no data repair is needed |
| Missing/invalid evidence | Omit unavailable evidence and log the signing failure; retain the rest of the audit response | Investigate delivery record; do not infer proof exists |
| Audit UI mistaken for delivery completion | Keep audit read-only and preserve the independent completion release gate | Proof visibility is not a staff-delivery GO decision |
| Legacy public proof URLs | Permit only validated HTTP(S) legacy URLs as temporary read compatibility | Track removal under a separately approved migration/retention plan |

See [risks_and_rollout.md](risks_and_rollout.md) for the operator release checklist and rollback decision tree.

## 5. Related

- [13_Production_Readiness_Checklist.md](13_Production_Readiness_Checklist.md)
- [ADR_SCOPE_AND_CORRECTION_PASS.md](ADR_SCOPE_AND_CORRECTION_PASS.md)
