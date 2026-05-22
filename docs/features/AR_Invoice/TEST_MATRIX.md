# AR Invoice v1 / v1.5 / v2 — Test Matrix

**Feature:** AR Invoice  
**Last Updated:** 2026-05-22

## Automated Coverage Added

| Area | File | Coverage |
|---|---|---|
| Validation | `web-admin/__tests__/validations/ar-invoice-schemas.test.ts` | Allocation validation, reversal validation, order-mode minimum input, manual invoice minimum input, credit application input, dispute resolution status guard, dunning command validation, statement-cycle creation validation |
| Service rule | `web-admin/__tests__/services/ar-invoice.service.test.ts` | `PAY_ON_COLLECTION` rejection for AR creation from orders |
| Tenant isolation | `web-admin/__tests__/tenant-isolation/ar-invoice-tenant-isolation.test.ts` | Customer balance projection remains tenant-scoped |

## Manual Verification Matrix

| Scenario | Expected Outcome |
|---|---|
| Create manual AR invoice | Draft invoice created with lines and totals |
| Create from one eligible order | Draft order-backed AR invoice created |
| Create from multiple eligible orders | Single grouped AR invoice created with linked orders |
| Attempt create from `PAY_ON_COLLECTION` order | Rejected before invoice creation |
| Issue draft invoice | Status transitions to open balance status and AR ledger debit is written |
| Allocate partial payment | Invoice remains open or partially paid with reduced outstanding |
| Allocate exact payment | Invoice becomes paid and outstanding becomes zero |
| Allocate overpayment | Excess becomes unapplied customer credit |
| Reverse allocation | Outstanding is restored and reversal ledger movement is written |
| Create credit memo requiring approval | Adjustment remains pending until approval |
| Approve credit memo | Adjustment posts and exposure decreases |
| Create debit note requiring approval | Adjustment remains pending until approval |
| Approve debit note | Adjustment posts and exposure increases |
| Write off remaining balance | Exposure reduces and invoice may become written off |
| Void approved invoice | Invoice becomes void and remaining exposure is reversed |
| Open customer statement print route | Printable statement payload loads and prints |
| Open invoice print route | Printable invoice payload loads and prints |
| Apply customer credit | Invoice outstanding reduces and credit application row is written |
| Reverse customer credit application | Invoice outstanding restores and credit application is marked reversed |
| Open dispute | Invoice moves to `DISPUTED` and dispute row is created |
| Resolve dispute | Dispute closes and invoice status is re-derived from canonical AR facts |
| Run dunning email or SMS | Dunning run row is written with sent/failed status |
| Run hold action | Customer `is_credit_hold` is set and dunning run is logged |
| Create statement cycle | Cycle row and optional custom customer links are created |
| Preview statement cycle | Matching customer sample is returned without mutating billing state |

## Validation Commands

Run from `web-admin`:

```bash
npm run typecheck
npm test -- __tests__/validations/ar-invoice-schemas.test.ts __tests__/auth/access-contracts.test.ts __tests__/auth/page-access-registry.test.ts __tests__/services/ar-invoice.service.test.ts __tests__/tenant-isolation/ar-invoice-tenant-isolation.test.ts --runInBand
npm run check:i18n
npm run build
```
