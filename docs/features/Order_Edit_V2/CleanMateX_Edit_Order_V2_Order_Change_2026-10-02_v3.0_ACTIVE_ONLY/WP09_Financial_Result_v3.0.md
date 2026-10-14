# WP09 Financial Result Projection

**Date:** 2026-10-14 (Asia/Muscat)
**Status:** DONE for in-memory financial classification. Snapshot equality, fiscal writing, and source-qualified follow-up remain later packages.
**Authority:** Living plan WP09, D005 outstanding formula in `order-financial-aggregation.ts`, and the rule that a delta tax document is not the full new obligation.

## Scope delivered

`projectOrderChangeFinancialResult` takes the projected total and tax, plus immutable payment, credit, refund, disposition, and fiscal-document facts. Outstanding is `aggregateOrderFinancials`, the existing D005 function. Overpayment is `computeOverpaidAmount`, the same complement the snapshot writer stores: completed real payments minus real-payment refunds, plus credits, minus the projected total, change returned, and dispositions. The function calls it once with dispositions at zero and once with the supplied dispositions. It does not copy or rewrite the payment rows.

- Paid 20 against total 15 is `OVERPAYMENT` of 5. Paid 10 against 20 and paid 20 against 25 are `OUTSTANDING`.
- A completed real payment and an applied credit both count. A pending gateway payment does not.
- A processed refund reopen increases outstanding. An existing disposition reduces unresolved overpayment and does not change the payment.
- Fiscal obligation is the original document plus later debit documents minus later credit documents. A credit of 5 against an original of 20 matches a projected total of 15.
- A second correction for the same Change reference is `DUPLICATE_CORRECTION`. Unsupported fiscal or issued AR correction is `DENIED`. A supported AR correction is advisory and is not posted here.

No `order_change_id` column was added. The Change reference stays on the supplied document fact until a later persistence package. No effect ledger was added.

## Files

- `web-admin/lib/services/order-change/order-change-financial-result.service.ts`
- `web-admin/__tests__/services/order-change/order-change-financial-result.service.test.ts`

No migration, permission, feature flag, route, or UI file was added. The D005 outstanding formula was not changed. The snapshot writer now calls `computeOverpaidAmount` for the same overpaid amount it previously calculated inline.

## Verification

Commands, from `web-admin`:

```text
npx jest __tests__/services/order-change/order-change-financial-result.service.test.ts --runInBand --forceExit --watchman=false
npx eslint lib/services/order-change/order-change-financial-result.service.ts __tests__/services/order-change/order-change-financial-result.service.test.ts --quiet
```

Results on 2026-10-14 after the reuse remediation: 5 tests passed. WP10 preview service and route tests, 11 in total, passed against the same outputs. Targeted ESLint exited 0. Covered scenarios OC-FIN-001 through OC-FIN-010 for the in-memory classification. No production build, database test, or browser test is claimed. Manual UI scenarios stay `NOT_EXECUTABLE_YET`.

## Dependencies

- Depends on the WP08 projected total and tax. It does not recalculate prices.
- Preview and Apply must pass completed settlement facts and must not treat this classification as a refund or collection.
- Fiscal and AR writers remain the owners of any later correction document.

## Gaps left to later packages

- No snapshot row is written, so Preview/active/snapshot equality is not proven here.
- Source-qualified refund and collection actions remain WP16.
- Lock ordering across payment, refund, and voucher writers remains open.
- This function does not issue a credit note, debit note, or AR adjustment.

## Existing code reuse and domain ownership — 2026-10-14

| Requirement | Existing code found | Canonical domain | Classification | Reused or changed files | Reason |
|---|---|---|---|---|---|
| Outstanding | `computeOutstanding` / `aggregateOrderFinancials` | Finance | REUSE_AS_IS | `order-financial-aggregation.ts` | D005 was not rewritten. |
| Overpayment | Snapshot writer formula at the overpaid assignment | Finance | REFACTOR_AND_REUSE | `computeOverpaidAmount`; writer and WP09 both call it | Refund reopens stay in outstanding. They are not subtracted a second time from overpayment. |
| Multi-document fiscal obligation | `evaluateTaxDocumentTotalMismatch` compares one document with the full sale total | Fiscal | NEW_REQUIRED | `order-change-financial-result.service.ts` | Edit compares original plus debit minus credit. A single delta document is not the full obligation. |
| Legacy amendment delta | `computeAmendmentDelta` | Legacy Edit | TEMPORARY_COMPATIBILITY | `order-amendment.service.ts` comment only | Its weaker overpayment is not called by V2. |

### Component record

| Field | Value |
|---|---|
| Component | `projectOrderChangeFinancialResult` |
| Domain owner | Order Change orchestration; outstanding and overpayment owned by `order-financial-aggregation.ts` |
| Responsibility | Classify the projected total against immutable settlement and fiscal facts |
| Should be domain-agnostic | No |
| Existing equivalents reviewed | D005 aggregation, snapshot writer, single-document tax mismatch, amendment delta |
| Canonical dependencies | `aggregateOrderFinancials`, `classifyRefunds`, `computeOverpaidAmount` |
| Legacy Edit behavior reviewed | `computeAmendmentDelta` remains for the live legacy path and is marked deprecated for new committed edits |
| Classification | NEW_REQUIRED classification over reused finance formulas |
| Why new code is required | No Edit preview classifier existed, and the single-document tax helper is the wrong comparison |
| How duplication is prevented | Overpayment is not copied beside the writer |
| Architecture verdict | Pass for this in-memory slice |

### Legacy behavior

| Legacy behavior | Keep behavior? | V2 destination | Legacy status |
|---|---|---|---|
| `computeAmendmentDelta` overpayment | No, for new committed edits | `projectOrderChangeFinancialResult` | TEMPORARY_COMPATIBILITY until V2 cutover |

## Database, API, and UI

No database object changes. No new endpoint. No screen. A later review screen can show the outcome and warnings.
