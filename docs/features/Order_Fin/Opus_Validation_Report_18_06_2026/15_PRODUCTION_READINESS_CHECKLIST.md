# 15 — Production Readiness Checklist

Status: ✅ met · 🟡 partial · 🔴 not met · ❓ not verified. "Required action" is the GA gate.

## Database

| Item | Status | Evidence | Required action | Owner |
|---|---|---|---|---|
| RLS on all `org_*` finance tables | 🔴 | 77/78; `org_tax_doc_seq_counters` off (F-01) | Migration: enable RLS + policies | DB/Backend |
| No catalog/CHECK drift | ✅ | 0378 FK; parity test | — | — |
| Idempotency on allocation effects | 🟡 | order/wallet/advance/CN/cash-in ✅ (indexes); **AR ✅ via central `org_idempotency_keys`**; B2B ✗ (F-02) | Add **B2B-only** idempotency | Backend/DB |
| No `payment_target_type` on order payments | ✅ | dropped 0337 | — | — |
| FKs/constraints sound | ✅ | verified | — | — |
| Migration safety (no rogue CASCADE) | ✅ | inspected | — | — |
| Tenant scoping on all writes | 🟡 | services filter; F-01 lacks DB net | Close F-01 | DB |

## Backend

| Item | Status | Required action |
|---|---|---|
| Single-transaction order posting | ✅ | — |
| Idempotency (route + sub-ops) | ✅ | — |
| B2B statement allocation idempotent | 🔴 | F-02 (AR already idempotent via `org_idempotency_keys`) |
| Collect-payment idempotency key event-unique | 🟡 | F-10 — require per-event key |
| Payment vs credit separation | ✅ | — |
| Pending/authorized not collected | ✅ | — |
| Recalc single source of truth | ✅ | — |
| Refund/reversal correctness | 🟡 | refunds structurally sound (over-refund cap + voucher links + recalc); reverse/void ❓ — verify `voucher-reversal` |

## APIs

| Item | Status | Required action |
|---|---|---|
| Permission checks on finance routes | ✅ (submit, collect, allocation-post) / ❓ (AR alloc, preview routes) | verify AR allocation + preview routes |
| Feature-flag gating where specified | 🔴 | F-03 — wire or retire flags |
| Schema validation (Zod) | ✅ | — |
| Error→HTTP mapping | ✅ | — |

## Frontend

| Item | Status | Required action |
|---|---|---|
| Canonical labels (no "paid" mislabel) | ✅ | — |
| Stored-value not shown as real payment | ✅ | — |
| Overpayment UX prevents pre-submit mistakes | ✅ | — |
| Flag-gated UI rollout | 🔴 | F-03 / UX-01 |
| Collect-payment + allocation drawers verified | ❓ | UX-03 review |
| i18n EN/AR parity | ✅ | PASS — `npm run check:i18n` (keys match) |
| Mobile/RTL of allocation drawers | ❓ | review |

## Tests

| Item | Status | Required action |
|---|---|---|
| Meaningful unit coverage of financial logic | ✅ | — |
| No false-positive catalog tests | ✅ (F-T1 fixed) | audit other constants tests |
| DB-level integration tests | 🔴 | T-1 harness |
| B2B idempotency test | 🔴 | T-2 |
| AR idempotency regression-lock test | 🟡 | T-3 (optional — AR already idempotent; lock so it can't regress) |
| Collect-payment idempotency test | 🔴 | F-10 |
| Wiring handler tests (invoice/statement) | 🔴 | T-4, T-5 |
| RLS regression test | 🔴 | T-6 |

## Security / RLS

| Item | Status | Required action |
|---|---|---|
| RLS tenant isolation everywhere | 🔴 | F-01 |
| Permission codes `resource:action` | ✅ | — |
| No hardcoded secrets (finance paths) | ✅ | — |
| CSRF on mutating finance routes | ✅ (submit, collect, allocation-post) / ❓ others | verify preview + AR routes |

## Data integrity / reconciliation

| Item | Status | Required action |
|---|---|---|
| `overpaid_amount` = unresolved only | ✅ | preview P-2 returns 0 |
| No silent unresolved excess | ✅ | validator blocks |
| AR-invoice-wins enforced | ✅ | preview P-4 |
| Statement payment audit trail | 🟡 | F-04 detail table |
| Reconciliation reports (unallocated excess) | ❓ | pending per plan backlog |

## Accounting / finance correctness

| Item | Status | Required action |
|---|---|---|
| Real payment vs credit vs AR vs pay-on-collection vs refund separation | ✅ | — |
| Multi-currency snapshot (base-cur fields) | ✅ | base_cur_* persisted |
| Tax single-rate VAT | ✅ | — |
| Tax category decomposition / e-invoicing | 🔴 | F-05 (scope decision) |
| Cash drawer reconcilable | 🟡 | F-07 change idempotency |

## GA gate (minimum)

**Must close:** F-01 (RLS), F-02 (**B2B-only** allocation idempotency), F-10 (collect-payment key) + tests T-1/T-2/T-6.
**Scope decision:** F-03 (flags) and F-05 (tax decomposition) — close or formally accept/defer.
**Recommended:** verify remaining ❓ (AR reverse/void accounting, allocation drawers, refund-create idempotency). i18n parity ✅ done.
**Note:** AR allocation is already idempotent (central `org_idempotency_keys`) — **no AR migration/index required.**
