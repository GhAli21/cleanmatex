# ADR-051 — Feature Flags Deferred for Order Fin V1

**Date:** 2026-06-18 · **Status:** Accepted (Approved_By_Jh) · **Decision ID:** D-01
**Ref:** [Opus_Validation_Report_18_06_2026/23_DECISIONS_ADDENDUM.md](../Opus_Validation_Report_18_06_2026/23_DECISIONS_ADDENDUM.md) · supersedes the flag-gating expectation in [ADR-047](./ADR-047-Overpayment-Disposition.md)

## Context
Migrations `0376`/`0377` seeded two HQ feature flags — `customer_receipt_allocation_v1` and `overpayment_disposition_v1`. The forensic validation (F-03) found they are referenced **nowhere** in `web-admin` code: no server gate, no UI gate. ADR-047 had stated `overpayment_disposition_v1` "gates UI panel and server validation."

## Decision
For V1, **do not wire these as runtime feature flags.** Treat both as **always enabled (= true)** for all tenants. Access is controlled by **permissions/RBAC + business validation** (already enforced: `orders:overpayment_allocate`, `customers:receipt_allocate`, `orders:overpayment_dispose`, and the catalog-driven `overpayment-resolution-validator`).

- No frontend/backend feature-flag checks for these two flags in Phase 1.
- The seed rows remain (harmless); they may be retired or repurposed later.
- **F-03 is removed from the GA gate** — it is an accepted launch decision, not a gap.

## Consequences
- **No per-tenant runtime kill-switch** for overpayment disposition / receipt allocation in V1. Mitigation: RBAC can withhold the permissions per role/tenant; a regression would be handled by hotfix/deploy, not a flag toggle. Accepted for V1.
- ADR-047's statement that the flag gates UI/server validation is **superseded** by this ADR.
- If a future release needs staged rollout, revisit: consume the flags via the HQ feature-flag API (per integration contracts) or via `org_tenants_mst.feature_flags`.

## Alternatives considered
- **Wire the flags now** (HQ API consumer + UI gate): rejected for V1 — adds cross-project work and a control path that RBAC already covers for launch.
- **Retire the seeds**: deferred — harmless to leave; avoids an extra migration now.
