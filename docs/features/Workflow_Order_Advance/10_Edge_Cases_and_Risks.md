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

## 4. Related

- [13_Production_Readiness_Checklist.md](13_Production_Readiness_Checklist.md)
- [ADR_SCOPE_AND_CORRECTION_PASS.md](ADR_SCOPE_AND_CORRECTION_PASS.md)
