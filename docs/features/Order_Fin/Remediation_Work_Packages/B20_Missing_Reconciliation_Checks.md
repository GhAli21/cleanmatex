# B20 — Missing Reconciliation Checks

## Metadata
Backlog ID: B20 · Severity: MEDIUM · Classification: CONTROL_GAP · Status: **IMPLEMENTED 2026-07-18** (see Completion evidence) — awaiting owner commit → Preview QA
Authoritative report sections: §13, §50-B20
Required decisions: [D005](00_Phase_0_Financial_Semantics/D005_Canonical_Outstanding_Formula.md)
Dependencies: [B02](B02_Shared_Financial_Aggregation.md) (hard) · Blocks: —
Recommended phase: Seq 3 (design) / after B2 (implementation)

## Confirmed problem
`TAX_CALCULATION` and `DISCOUNT_VALIDATION` exist as check-name constants but are unimplemented (reconciliation.service.ts:66–71); D005 also mandates a new refunds-vs-reopen-policy consistency check replacing recon's dropped `+ processedRefunds` conservatism.

## Current evidence
| File or symbol | Current behavior | Gap |
|---|---|---|
| reconciliation.service.ts:73–117 | 35 executed checks; 2 constants excluded | implement or drop |
| §13 | recon must consume shared aggregation | new checks must too |

## Required outcome
Implement TAX_CALCULATION (tax facts vs engine recompute per mode), DISCOUNT_VALIDATION (discount facts vs rules/caps), and REFUND_REOPEN_CONSISTENCY (refund rows vs D003 policy) — all via the B2 shared module; `total_checked` updated.

## Scope
Three checks + severities + fixtures.

## Out of scope
Aggregation module (B2); BVM↔GL check (B6).

## Financial effects
| Area | Impact |
|---|---|
| Commercial total | NO |
| Payment facts | NO |
| Credit applications | NO |
| BVM | NO |
| Cash drawer | NO |
| Gateway or bank | NO |
| Tax documents | NO |
| ERP-Lite GL | NO |
| Snapshot | NO |
| Reconciliation | YES |
| Customer receipt | NO |
| Audit/outbox | NO |

## Acceptance criteria
Injected tax drift / illegal discount / policy-violating reopen each produce exactly one issue; clean fixtures stay green; check count constant matches reality.

## Required tests
unit (each check), reconciliation fixtures, regression.

## Dependencies and sequencing
Implementation strictly after B2.

## Delivery surfaces

Backend services: three checks (TAX_CALCULATION, DISCOUNT_VALIDATION, REFUND_REOPEN_CONSISTENCY) in reconciliation/, consuming the B2 shared module; EXECUTED_CHECK_NAMES/total_checked updated
Database/schema: none (issues persist to existing recon tables)
API/endpoints: none new (existing recon run/read routes)
Frontend page/screen/dialog/action: NOT_APPLICABLE
Reason: new checks render through the existing reconciliation results screens — no new UI element beyond three new check names
Existing consumer: finance reconciliation screens + per-order financial-reconcile panel (display new check rows automatically)
Operational visibility: run results with per-check pass/fail as today
Failure detection: injected-drift fixtures per check
Recovery method: checks are read-only; disable by removing from EXECUTED_CHECK_NAMES
Reusable components/helpers: B2 aggregation module
Permissions: existing reconciliation:run/view
Validation: severities per check class
i18n/RTL: EN/AR labels for the three new check names
Accessibility: NOT_APPLICABLE (existing tables)
Audit trail: recon run rows as today
Observability: check pass-rate trend
Jobs/workers: scheduled recon (B19 infra) consumes automatically
Feature flag: none (additive checks)
Rollout: after B2; fixtures first
Rollback: remove check names from executed list

## Completion evidence

**Migration:** none (additive check logic only, as scoped).

**Implementation (2026-07-18):**
- NEW `lib/services/reconciliation/financial-integrity-checks.ts` — three checks, all consuming the B02 shared aggregation authority's helpers (`round4`/`toAmount`) and the D005 order-level tolerance (`ORDER_FINANCIAL_COMPARISON_TOLERANCE`), never re-deriving their own:
  - **`checkTaxCalculation`** — (a) line-level recompute: `expectedTax = round4(taxable_amount × rate)` compared to the persisted `org_order_taxes_dtl.tax_amount`; (b) header roll-up: Σ active tax lines vs `org_orders_mst.total_tax_amount`. Wires the previously-unimplemented `TAX_CALCULATION` constant.
  - **`checkDiscountValidation`** — (a) rule: a `PERCENTAGE` discount's `discount_rate` must be within (0, 100]; (b) cap: Σ active discounts must not exceed the discountable base (`items_base_amount + total_charges_amount`, mirroring the canonical total formula's itemsBase+charges−discounts term); (c) header roll-up: Σ active discounts vs `total_discount_amount`. Wires the previously-unimplemented `DISCOUNT_VALIDATION` constant.
  - **`checkRefundReopenConsistency`** — NEW check + NEW constant `REFUND_REOPEN_CONSISTENCY` (`lib/constants/order-financial.ts`). Flags any `org_order_refunds_dtl` row with a positive `reopens_due_amount` whose `refund_context` is not `REFUND_AND_REBILL`/`MANUAL_EXCEPTION` (D003 v2 invariant 7) — a monitoring layer over the DB `chk_refund_reopen_context_v2` CHECK constraint (migration 0404) that also catches any pre-0404/legacy/synthetic row the DB constraint predates.
- `lib/services/reconciliation.service.ts` — all three registered in `EXECUTED_CHECK_NAMES` (so `total_checked` grows from 35 to 38 automatically — no magic number to update) and fanned into the `Promise.all` alongside the existing per-order/window checks.
- All money comparisons at the frozen D005 order-level tolerance (0.001); severities all `BLOCKER` (money-integrity / financial-policy violations, consistent with the sibling detail-vs-header checks in `order-checks.ts`/`order-snapshot-checks.ts`).

**Tests:** NEW `__tests__/services/reconciliation/financial-integrity-checks.test.ts` (15 tests — empty-input short-circuits, line/header/rate/cap violation + clean-path per check, PROCESSING-vs-allowed refund_context matrix). Extended the shared prisma mocks in `__tests__/services/reconciliation.service.test.ts` and `__tests__/integration/reconciliation-run.test.ts` with `org_order_taxes_dtl` (both files already mocked `org_order_discounts_dtl` for the pre-existing discount-source check) — this **fixed 11 then 5 pre-existing-shaped failures** that surfaced only because those two orchestrator-level test files hadn't been updated for the new fan-out call; both suites are now fully green. Full reconciliation suite: **64/64 green** (financial-integrity-checks 15 + check-modules 32 + reconciliation.service 12 + reconciliation-run integration 5).

**Gates (2026-07-18, all green):** `npx eslint … --quiet` 0 · `npx tsc --noEmit` clean · targeted jest 64/64 · `npm run build` — see status. i18n not applicable (no UI/strings — B20 is `Frontend page/screen/dialog/action: NOT_APPLICABLE`, new check names render through the existing reconciliation results screens with zero new UI elements).

**Commit:** — (owner) · **Preview QA (deploy/result/approval):** — pending (run reconciliation on Preview against fixtures with injected tax drift / illegal discount / policy-violating reopen — each must produce exactly one issue per §-Acceptance criteria; clean fixtures must stay green; verify `total_checked` reads 38) · **Reviewer:** — · **Verification:** — · **Authoritative report update:** — (after Preview QA; §13's "Other issues: TAX_CALCULATION / DISCOUNT_VALIDATION constants unimplemented" line becomes stale once VERIFIED — candidate for a B29 correction annotation).
