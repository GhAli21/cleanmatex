# 23 — Decisions Addendum (final, approved)

**Date:** 2026-06-18 · **Status:** Approved_By_Jh · **Supersedes** the open questions in [20](./20_OPEN_QUESTIONS.md).

These are the binding product/architecture decisions applied after the forensic report ([22](./22_FOLLOWUP_DEEP_DIVE.md) deep-dive). Where a decision changes a finding's severity, GA status, or scope, the affected report files are updated and cross-reference this addendum.

| ID | Decision | Effect on report |
|----|----------|------------------|
| **D-01** | **Feature flags deferred for V1.** `overpayment_disposition_v1` and `customer_receipt_allocation_v1` are treated as **always enabled (=true)** for all tenants in V1. Access is controlled by **permissions/RBAC + business validation**, not runtime flags. No flag-gating implemented in Phase 1. | **F-03 removed from GA gate** (accepted launch decision, not a gap). ADR-047 flag claim corrected. |
| **D-02** | **E-invoicing foundation is in launch scope → F-05 is a GA gate.** Add tenant enablement: `is_e_invoice_enabled` (bool, default false) + `e_invoice_enabled_start_date` (date). Active only when `is_e_invoice_enabled=true AND order_date >= e_invoice_enabled_start_date`. Country adapters (e.g. ZATCA) are separate jurisdiction adapters, GA-blocking only for launch jurisdictions. | **F-05 elevated to GA gate.** Implemented as its **own phase** (not bundled into the tight Phase 1). Tenant-flag placement decision pending (see §Open implementation decisions). |
| **D-03** | **`VOID_OR_REFUND_EXCESS` + `RESTORE_STORED_VALUE` stay deferred from checkout V1.** Catalog codes kept; validator keeps rejecting them (`NOT_ALLOWED`); not exposed in UI. Allowed V1 resolutions: `REDUCE_PAYMENT`, `RETURN_CASH_CHANGE`, `SAVE_AS_CUSTOMER_ADVANCE`, `SAVE_TO_CUSTOMER_WALLET`, `SAVE_AS_CUSTOMER_CREDIT`, `ALLOCATE_TO_CUSTOMER_BALANCES`, `AUTO_ALLOCATE_TO_CUSTOMER_BALANCES`. | Matches current code (validator already rejects). Documented as intentional; no code change. |
| **D-04** | **B2B statement payment detail table required** (`org_b2b_statement_payments_dtl`) — tenant, statement, customer, voucher header + line, amount, currency, idempotency key, audit/status fields. | **F-04 in Phase 1B.** |
| **D-05** | **Collect-payment requires a per-event idempotency key.** No reliance on `${orderId}_collect_${collectedBy}`. UI/POS generates a stable per-attempt key; retry reuses it; a new partial collection uses a new key. | **F-10 in Phase 1C.** Implemented non-breaking: server falls back to a per-request UUID if absent (kills the collision), UI sends a stable per-attempt key for retry-dedup. |
| **D-06** | **Refund creation must be idempotent before GA.** Implement in the third pass (D-12) unless trivially in Phase 1 scope (it is not). | Recorded as a **GA-before requirement**, third-pass item. |
| **D-07** | **Point-in-time FX snapshot is sufficient for launch.** Formal AR revaluation + FX gain/loss posting deferred to a later ERP/period-close phase. | Documented limitation; not a GA gate. |
| **D-08** | **Tax-sequence RLS uses tenant isolation + service_role.** Server sequence service must keep working under service role. | **F-01 Phase 1A** (already the planned approach). |
| **D-09** | **Minimum reconciliation reports are launch-required:** unresolved/unallocated excess; B2B statement payment reconciliation; overpayment disposition reconciliation; cash drawer movement reconciliation. Advanced reporting phased later. | Added to GA gate as a **reporting workstream** (own phase, not tight Phase 1). |
| **D-10** | **DB-level finance test harness approved + required (F-T5).** Real migration/DB-based invariants: RLS on seq counters, overpay-disp FK/catalog parity, B2B idempotency replay, collect-payment idempotency, wallet disposition regression. | **F-T5 elevated to GA gate**, implemented as its own phase. |
| **D-11** | **Focused re-validation required after Phase 1.** | Recorded; [21](./21_FINAL_RECOMMENDATION.md) updated. |
| **D-12** | **Third pass required before GA** for the remaining ❓: refund-create idempotency, AR reverse/void accounting, `voucher-reversal.service`, cash-drawer close/Z-report, promotion engine, loyalty engine, gateway capture/callback, allocation drawer UX, mobile/offline POS. | Recorded; [20](./20_OPEN_QUESTIONS.md) → third-pass backlog. |

## Updated GA gate (binding)

```
F-01 — RLS on org_tax_doc_seq_counters                 (Phase 1A — this batch)
F-02 — B2B statement payment idempotency               (Phase 1B — this batch)
F-04 — B2B statement payment detail/audit table        (Phase 1B — this batch)
F-10 — collect-payment per-event idempotency key        (Phase 1C — this batch)
F-T5 — DB-level finance test harness                   (own phase — approved)
F-05 — e-invoicing foundation + tax decomposition      (own phase — launch scope)
D-09 — minimum reconciliation reports                  (own phase — launch-required)
```

**Removed from GA gate:** **F-03** (feature flags) — accepted launch decision per D-01.

## Phasing applied (per approved scope: "Decisions + tight Phase 1")

- **This batch (tight Phase 1):** Docs/decisions + **1A** (F-01 RLS) + **1B** (F-02/F-04 B2B idempotency + detail) + **1C** (F-10 collect-payment key).
- **Own subsequent phases (decided, not in this batch):** F-T5 DB harness · F-05 e-invoicing foundation · D-09 reconciliation reports · D-12 third-pass closure.

## Open implementation decisions (surfaced, not yet chosen) — for the e-invoicing phase

> Flagged because the repo reality affects the design; do not assume:
1. **E-invoice tenant-flag placement.** `org_tenants_mst` already has a **`feature_flags` jsonb** column plus `tax_pricing_mode`, `country`, `country_code`. Options: (a) dedicated `is_e_invoice_enabled` + `e_invoice_enabled_start_date` columns (D-02 literal); (b) store in the existing `feature_flags` jsonb; (c) model as an HQ-managed tenant setting per the CLAUDE.md "settings/feature-flags are cleanmatexsaas-managed, consumed via API" rule. **Cross-project** (cleanmatexsaas owns tenant management). To decide before the e-invoicing phase.
2. **Tax decomposition is greenfield.** The tax engine emits only a single `taxable_amount` today; EXEMPT/ZERO_RATED/OUT_OF_SCOPE require per-line tax-category work. The e-invoicing phase delivers the **tenant flag + activation + status/audit scaffolding**; the actual decomposition is a tracked follow-up. **F-05 must not be marked "complete" until decomposition is real.**
