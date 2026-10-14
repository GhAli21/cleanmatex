# WP09 Financial Result Projection

**Date:** 2026-10-14 (Asia/Muscat)
**Status:** PARTIAL — in-memory financial classification is implemented and focused-tested; retroactive reuse/domain-boundary governance audit is required before unqualified DONE status.
**Authority:** Living plan WP09, D005 outstanding formula in `order-financial-aggregation.ts`, and the rule that a delta tax document is not the full new obligation.

## Scope delivered

`projectOrderChangeFinancialResult` takes the projected total and tax, plus immutable payment, credit, refund, disposition, and fiscal-document facts. Outstanding is `aggregateOrderFinancials`, the existing D005 function. Overpayment is the complement of that same collected amount. The function does not copy or rewrite the payment rows.

- Paid 20 against total 15 is `OVERPAYMENT` of 5. Paid 10 against 20 and paid 20 against 25 are `OUTSTANDING`.
- A completed real payment and an applied credit both count. A pending gateway payment does not.
- A processed refund reopen increases outstanding. An existing disposition reduces unresolved overpayment and does not change the payment.
- Fiscal obligation is the original document plus later debit documents minus later credit documents. A credit of 5 against an original of 20 matches a projected total of 15.
- A second correction for the same Change reference is `DUPLICATE_CORRECTION`. Unsupported fiscal or issued AR correction is `DENIED`. A supported AR correction is advisory and is not posted here.

No `order_change_id` column was added. The Change reference stays on the supplied document fact until a later persistence package. No effect ledger was added.

## Files

- `web-admin/lib/services/order-change/order-change-financial-result.service.ts`
- `web-admin/__tests__/services/order-change/order-change-financial-result.service.test.ts`

No migration, permission, feature flag, route, or UI file was added. The D005 formula and the financial writer were not modified.

## Verification

Commands, from `web-admin`:

```text
npx jest __tests__/services/order-change/order-change-financial-result.service.test.ts --runInBand --forceExit --watchman=false
npx eslint lib/services/order-change/order-change-financial-result.service.ts __tests__/services/order-change/order-change-financial-result.service.test.ts --quiet
```

Results: 5 tests passed. ESLint exited 0. No production build, database test, or browser test is claimed.

## Dependencies

- Depends on the WP08 projected total and tax. It does not recalculate prices.
- Preview and Apply must pass completed settlement facts and must not treat this classification as a refund or collection.
- Fiscal and AR writers remain the owners of any later correction document.

## Gaps left to later packages

- No snapshot row is written, so Preview/active/snapshot equality is not proven here.
- Source-qualified refund and collection actions remain WP16.
- Lock ordering across payment, refund, and voucher writers remains open.
- This function does not issue a credit note, debit note, or AR adjustment.

## Governance adoption note — 2026-10-14

This package was implemented before `CleanMateX_Edit_Order_V2_Order_Change_2026-10-02_v3.0_Implementation_Governance.md` was adopted. Its existing focused tests and scope evidence remain valid, but they do not prove the newly required reuse/domain-ownership/separation-of-concerns gate.

Before this package returns to unqualified `DONE`, perform the retroactive audit required by that governance contract against the actual codebase. Classify each significant component as `REUSE_AS_IS`, `REUSE_WITH_EXTENSION`, `REFACTOR_AND_REUSE`, `REPLACE`, or `NEW_REQUIRED`; inspect relevant legacy Edit behavior; verify canonical domain ownership, single-source-of-truth and dependency direction; then record any remediation and re-run affected tests.

No defect is asserted merely by this status change. The missing artifact is the newly required architecture/governance evidence.

## Database, API, and UI

No database object changes. No new endpoint. No screen. A later review screen can show the outcome and warnings.
