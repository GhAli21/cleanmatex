# B04 — Later Collection BVM Parity

## Metadata
Backlog ID: B4 · Severity: HIGH · Classification: BLOCKS_PRODUCTION · Status: NOT_STARTED
Authoritative report sections: H1, §6, §32, §50-B4
Required decisions: [D001](00_Phase_0_Financial_Semantics/D001_Payment_Lifecycle_And_Status_Transitions.md), [D007](00_Phase_0_Financial_Semantics/D007_BVM_And_ERP_Lite_Responsibilities.md)
Dependencies: none · Blocks: [B05](B05_Later_Collection_Idempotency.md), [B31](B31_Later_Collection_Default_Status.md) (hard); [B06](B06_ERP_Order_To_Cash_Event_Wiring.md) (impl)
Recommended phase: Seq 4

## Confirmed problem
`collectPaymentTx` writes payment + drawer facts directly with **no BVM receipt voucher** — completed rows lack voucher backlinks and trip the platform's own `ORDER_PAYMENT_LINK_EXISTS` blocker (H1); no fiscal receipt artifact for collections.

## Current evidence
| File or symbol | Current behavior | Gap |
|---|---|---|
| order-settlement.service.ts:829+ | direct `org_order_payments_dtl.create` | no voucher/wiring |
| order-checks.ts:312–338 | flags voucher-less COMPLETED payments as BLOCKER | invariant violated by design |
| order-settlement-planner.service.ts | canonical planner unused by collect | plan/validate parity missing |

## Required outcome
Later collection runs through the canonical planner + BVM path (voucher → lines → post/wire → snapshot), producing parity with submit: voucher links, drawer wiring via handler, receipt artifact, recon green.

## Scope
Collect service refactor onto planner + `createBizVoucher`/`addVoucherLine`/`postAndWireBizVoucher`; drawer movement moves into the wiring handler; both collect routes converge on one implementation.

## Out of scope
Idempotency keys (B5); D9 status honoring (B31); ERP events (B6).

## Financial effects
| Area | Impact |
|---|---|
| Commercial total | NO |
| Payment facts | YES (creation path changes) |
| Credit applications | NO |
| BVM | YES |
| Cash drawer | YES (handler-driven) |
| Gateway or bank | NO |
| Tax documents | NO |
| ERP-Lite GL | POSSIBLE (enables B6) |
| Snapshot | YES (same totals, new lineage) |
| Reconciliation | YES (blockers resolve) |
| Customer receipt | YES (voucher receipt) |
| Audit/outbox | YES |

## Acceptance criteria
Every collect-created COMPLETED payment carries `fin_voucher_id` + `fin_voucher_trx_line_id`; `ORDER_PAYMENT_LINK_EXISTS` passes on collection scenarios; drawer totals unchanged vs today for identical inputs.

## Required tests
integration, API, reconciliation, regression (multiple partial collections; §49 rows).

## Dependencies and sequencing
Before B5/B31 (they modify the same path); enables B6 later-collection events.

## Delivery surfaces

Backend services: collectPaymentTx refactored onto buildSettlementPlan + createBizVoucher/addVoucherLine/postAndWireBizVoucher; drawer movement moves into cash-drawer wiring handler
Database/schema: none new (voucher backlinks populate existing columns)
API/endpoints: POST /orders/[id]/collect-payment and /orders/[id]/payments converge on one handler (single contract)
Frontend page/screen/dialog/action: existing collect-payment modal unchanged in layout; gains voucher-receipt link on success and identical error-code mapping to submit
Reusable components/helpers: settlement planner reuse; voucher receipt print (existing)
Permissions: existing `orders:collect_payment`
Validation: same planner validations as submit (reference/terminal/drawer/change rules)
i18n/RTL: reuse existing collect + payment error keys; add voucher-receipt link label EN/AR
Accessibility: unchanged modal semantics
Audit trail: voucher lineage on every collection payment; outbox PAYMENT_RECEIVED retained
Observability: ORDER_PAYMENT_LINK_EXISTS goes green on collections (recon)
Jobs/workers: none
Feature flag: `order_fin.collect_via_bvm` for staged cutover
Rollout: flag on staging → parity assertions (totals identical, plus voucher links) → production enable → retire direct-write branch (B23)
Rollback: flag off restores current direct path (accepting the known H1 gap)

## End-to-end operational flow

1. Cashier opens Collect Payment on a PAY_ON_COLLECTION order, enters legs, submits.
2. Planner validates; voucher + lines created; wiring writes payment facts + drawer movement; snapshot recalcs — one tx.
3. Modal confirms with printable voucher receipt; payments show voucher links on the Financial tab.
4. Reconciliation passes voucher-link checks; failure rolls back the whole collection atomically.

UI states: standard Cmx state contract — loading, empty, validation errors, permission-denied (action disabled with reason), duplicate-click protection (in-flight disable + idempotent replay via B5), processing, success, retry on failure; collection history visible on the order Financial tab.

## Safety

UI design allowed: YES (no UI change needed) · UI implementation allowed: YES
Production activation allowed: after parity tests green (totals + drawer identical to current path)
Required backend gates: none external — this package's voucher path only
Required decision gates: D001, D007 conformance (no approval blocker for parity mode)
Required verification gates: parity assertions green (totals, drawer, voucher links) on staging

## Completion evidence
Migration: — · Implementation files: — · Tests: — · Commit: — · Preview QA (deploy/result/approval): — · Reviewer: — · Verification: — · Authoritative report update: —
