# WP08 Edit Calculation Adapter

**Date:** 2026-10-14 (Asia/Muscat)
**Status:** PARTIAL — pure calculation adapter is implemented and focused-tested; retroactive reuse/domain-boundary governance audit is required before unqualified DONE status.
**Authority:** Living plan WP08, architecture tax-mode wording, WP07 contribution cache, and the current Create calculator's unchanged base-price behavior.

## Decision

Create's calculator still consumes `basePrice` or an item override. That path was not changed. For an Edit line that is new or policy-relevant, the authoritative selling unit is an authorized override when present. Otherwise it is `finalPrice` when the resolved quote has a positive discount percent, and `basePrice` when it does not. The catalog adjustment is therefore counted once on those lines. An unchanged line keeps `persistedUnitPrice` even when a newer quote is supplied.

ITEM and PIECE extras stay inside the line amount. ORDER extras are added once outside that line. A charge typed `PREFERENCE` is ignored because the ORDER addend already represents it. Other charges are non-taxable addends. A promotion already redeemed on the order contributes zero. A new promotion amount is capped by the remaining cap and is not written as a redemption.

## Scope delivered

`calculateOrderChangeTotals` accepts resolved quotes, one tax rate, currency display places, the WP07 order addend, charges, and an optional promotion. It returns four-decimal totals, a display total rounded half-up to the currency places, and a fingerprint. A different reviewed fingerprint or display total sets `requiresReReview`. The function is synchronous and does not import Prisma, Supabase, or the existing pricing and tax loaders.

## Files

- `web-admin/lib/services/order-change/order-change-calculation.service.ts`
- `web-admin/__tests__/services/order-change/order-change-calculation.service.test.ts`

No migration, permission, feature flag, route, or UI file was added. `order-calculation.service.ts` was not modified.

## Verification

Commands, from `web-admin`:

```text
npx jest __tests__/services/order-change/order-change-calculation.service.test.ts __tests__/services/order-calculation.service.test.ts --runInBand --forceExit --watchman=false
npx eslint lib/services/order-change/order-change-calculation.service.ts __tests__/services/order-change/order-change-calculation.service.test.ts --quiet
```

Results: Edit adapter 6 passed; existing Create calculation suite 23 passed; ESLint exited 0. Covered Edit cases: non-zero catalog adjustment once, unchanged line after a catalog change, override permission, both tax modes, all three preference levels, promotion cap and no second redemption, four-decimal persistence, display rounding boundary, and review drift. No production build, database test, or browser test is claimed.

## Dependencies

- Uses WP07's split between line extras and the ORDER addend. It does not re-sum preference rows.
- Preview must resolve the quote, tax rate, currency places, and promotion cap before calling this function. Apply must call the same function and reject a drifted fingerprint.
- Create calculation remains the owner of its current base-price subtotal.

## Gaps left to later packages

- Compound tax profiles and the tenant VAT fallback stay in `calculateTaxInTx`. This adapter applies one supplied rate.
- HQ currency-increment rounding stays in `currency-rounding.ts`. This adapter rounds the display total half-up to the supplied decimal places only.
- No Preview or Apply route calls this function.
- Persisted item columns remain numeric(10,3). Returning four-decimal strings does not convert those columns.
- Gift cards, payments, and settlement are not applied.

## Governance adoption note — 2026-10-14

This package was implemented before `CleanMateX_Edit_Order_V2_Order_Change_2026-10-02_v3.0_Implementation_Governance.md` was adopted. Its existing focused tests and scope evidence remain valid, but they do not prove the newly required reuse/domain-ownership/separation-of-concerns gate.

Before this package returns to unqualified `DONE`, perform the retroactive audit required by that governance contract against the actual codebase. Classify each significant component as `REUSE_AS_IS`, `REUSE_WITH_EXTENSION`, `REFACTOR_AND_REUSE`, `REPLACE`, or `NEW_REQUIRED`; inspect relevant legacy Edit behavior; verify canonical domain ownership, single-source-of-truth and dependency direction; then record any remediation and re-run affected tests.

No defect is asserted merely by this status change. The missing artifact is the newly required architecture/governance evidence.

## Database, API, and UI

No database object changes. No new endpoint. No Edit screen. The display total is a calculation fact for a later review screen.
