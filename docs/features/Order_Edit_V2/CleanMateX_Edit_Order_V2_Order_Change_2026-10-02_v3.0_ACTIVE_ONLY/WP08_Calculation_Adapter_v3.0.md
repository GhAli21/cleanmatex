# WP08 Edit Calculation Adapter

**Date:** 2026-10-14 (Asia/Muscat)
**Status:** DONE for the pure calculation adapter. Compound tax resolution, currency-increment rounding, and persistence scale remain later packages.
**Authority:** Living plan WP08, architecture tax-mode wording, WP07 contribution cache, and the current Create calculator's unchanged base-price behavior.

## Decision

Create's calculator still consumes `basePrice` or an item override. That path was not changed. For an Edit line that is new or policy-relevant, the authoritative selling unit is an authorized override when present. Otherwise it is `finalPrice` when the resolved quote has a positive discount percent, and `basePrice` when it does not. The catalog adjustment is therefore counted once on those lines. An unchanged line keeps `persistedUnitPrice` even when a newer quote is supplied.

ITEM and PIECE extras stay inside the line amount. ORDER extras are added once outside that line. A charge typed `PREFERENCE` is ignored because the ORDER addend already represents it. Other charges are non-taxable addends. A promotion already redeemed on the order contributes zero. A new promotion amount is capped by the remaining cap and is not written as a redemption.

## Scope delivered

`calculateOrderChangeTotals` accepts resolved quotes, one tax rate, currency display places, the WP07 order addend, charges, and an optional promotion. It returns four-decimal totals, a display total rounded half-up to the currency places, and a fingerprint. A different reviewed fingerprint or display total sets `requiresReReview`. Inclusive tax calls `extractTaxFromInclusive`. Exclusive tax calls `applyExclusiveTax`. Display rounding calls `roundMoneyAmount` with the four-decimal string. The function is synchronous and does not import Prisma, Supabase, or the existing pricing and tax loaders.

## Files

- `web-admin/lib/services/order-change/order-change-calculation.service.ts`
- `web-admin/lib/services/tax-extraction.ts`
- `web-admin/__tests__/services/order-change/order-change-calculation.service.test.ts`

No migration, permission, feature flag, route, or UI file was added. `order-calculation.service.ts` was not modified. The snapshot writer re-exports `extractTaxFromInclusive` from the pure tax module so existing callers keep the same function.

## Verification

Commands, from `web-admin`:

```text
npx jest __tests__/services/order-change/order-change-calculation.service.test.ts __tests__/services/order-calculation.service.test.ts --runInBand --forceExit --watchman=false
npx eslint lib/services/order-change/order-change-calculation.service.ts __tests__/services/order-change/order-change-calculation.service.test.ts --quiet
```

Results on 2026-10-14 after the reuse remediation: Edit adapter 6 passed; existing Create calculation suite 23 passed; inclusive extraction suite in `order-financial-pricing-mode.test.ts` passed; `format-money` 8 passed, including string `"1.0050"` at two places rounding to `1.01`. Targeted ESLint exited 0. Covered scenarios OC-CALC-001 through OC-CALC-009 for the pure adapter. OC-CALC-010 currency-increment rounding stays `AUTOMATION_PLANNED` because `currency-rounding.ts` is server-only and was not copied. No production build, database test, or browser test is claimed. Manual UI scenarios stay `NOT_EXECUTABLE_YET`.

## Dependencies

- Uses WP07's split between line extras and the ORDER addend. It does not re-sum preference rows.
- Preview must resolve the quote, tax rate, currency places, and promotion cap before calling this function. Apply must call the same function and reject a drifted fingerprint.
- Create calculation remains the owner of its current base-price subtotal.

## Gaps left to later packages

- Compound tax profiles and the tenant VAT fallback stay in `calculateTaxInTx`. This adapter applies one supplied rate.
- HQ currency-increment rounding stays in `currency-rounding.ts`. This adapter rounds the display total half-up to the supplied decimal places only.
- No persistence route writes this function's four-decimal strings into numeric(10,3) item columns.
- Gift cards, payments, and settlement are not applied.
- Preview already calls this function. Apply must call the same function.

## Existing code reuse and domain ownership — 2026-10-14

| Requirement | Existing code found | Canonical domain | Classification | Reused or changed files | Reason |
|---|---|---|---|---|---|
| Quote selection and unchanged-line price | Create calculator uses `basePrice` and is not an Edit quote selector | Pricing | NEW_REQUIRED | `order-change-calculation.service.ts` | Edit orchestration only. Create was not rewritten. |
| Inclusive tax | `extractTaxFromInclusive` lived inside the snapshot writer | Tax | REFACTOR_AND_REUSE | `tax-extraction.ts`; writer re-exports it | The formula moved once. Edit and the writer share it. Rate stays a fraction. |
| Exclusive tax | Create uses `afterDiscounts * vatRate` | Tax | NEW_REQUIRED shared helper | `applyExclusiveTax` in `tax-extraction.ts` | Same exclusive rule, callable without the writer. Create's calculator was left unchanged because its result path also rounds to currency places. |
| Display half-up | `roundMoneyAmount` | Money | REUSE_WITH_EXTENSION | `format-money.ts` | Decimal strings now use exact half-up. Numeric `toFixed` callers are unchanged. |
| Currency increment | `roundToIncrement` in `currency-rounding.ts` | Money | REUSE_AS_IS, not called here | none | The module is server-only. The caller must resolve a rule before a later package applies it. |

### Component record

| Field | Value |
|---|---|
| Component | `calculateOrderChangeTotals` |
| Domain owner | Order Change orchestration; tax split owned by `tax-extraction.ts`; display rounding owned by `format-money.ts` |
| Responsibility | Compose resolved quotes, one rate, and the WP07 addend into a review total |
| Should be domain-agnostic | No |
| Existing equivalents reviewed | Create calculator, snapshot tax extraction, currency rounding |
| Canonical dependencies | `extractTaxFromInclusive`, `applyExclusiveTax`, `roundMoneyAmount`, `round4` |
| Legacy Edit behavior reviewed | Create base-price subtotal stays with Create |
| Classification | NEW_REQUIRED orchestration over reused tax and money helpers |
| Why new code is required | No pure Edit quote composer existed |
| How duplication is prevented | Inclusive and exclusive formulas are not copied in the adapter |
| Architecture verdict | Pass for the pure adapter |

### Legacy behavior

| Legacy behavior | Keep behavior? | V2 destination | Legacy status |
|---|---|---|---|
| Create base-price subtotal | Yes, for Create | Unchanged `order-calculation.service.ts` | REUSE_AS_IS |

## Database, API, and UI

No database object changes. No new endpoint. No Edit screen. The display total is a calculation fact for a later review screen.
