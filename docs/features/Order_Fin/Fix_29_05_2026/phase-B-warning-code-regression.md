# Phase B — Financial Warning Code Regression Suite

**Date:** 2026-06-05  
**Migration:** none  
**Program:** Post-v1.1 Hardening

---

## Goal

Add regression coverage for all 13 `buildWarningCodes` warning codes in `order-financial-write.service.ts`. Prior to this phase, only `TAX_DOCUMENT_TOTAL_MISMATCH` had a dedicated test. The other 12 had zero regression coverage.

---

## Discovery: Missing Implementation

During test authoring, `LEGACY_FIELD_USED_IN_SUMMARY` was found to have zero trigger logic in `buildWarningCodes`. The input parameter `usedHeaderTotalFallback` existed and the warning constant was defined, but the `warnings.add()` call was never written. The missing check was added as part of this phase:

```typescript
if (input.usedHeaderTotalFallback) {
  warnings.add(ORDER_FINANCIAL_WARNING_CODES.LEGACY_FIELD_USED_IN_SUMMARY);
}
```

---

## Files Modified

| File | Change |
|---|---|
| `lib/services/order-financial-write.service.ts` | Added `export` to `buildWarningCodes`; added missing `LEGACY_FIELD_USED_IN_SUMMARY` check |
| `__tests__/services/financial/order-financial-warning-codes.test.ts` | New file — 29 tests covering all 13 warning codes |

---

## Test Coverage Matrix

| Code | Trigger condition tested |
|---|---|
| `ORDER_TOTAL_COMPONENT_MISMATCH` | `recomputedTotalAmount ≠ orderTotalAmount` (diff > 0.001) |
| `DISCOUNT_TOTAL_MISMATCH` | `recomputedDiscountAmount ≠ orderDiscountAmount` |
| `TAX_TOTAL_MISMATCH` | `recomputedTaxAmount ≠ orderTaxAmount` |
| `OUTSTANDING_MISMATCH` | `recomputedOutstandingAmount ≠ orderOutstandingAmount` |
| `PENDING_PAYMENT_COUNTED_AS_PAID` | `pendingPaymentAmount > 0` |
| `AUTHORIZED_PAYMENT_COUNTED_AS_PAID` | `authorizedPaymentAmount > 0` |
| `GIFT_CARD_DOUBLE_COUNTED` | `giftCardAppliedAmount > 0 && totalCreditAppliedAmount + tolerance < giftCardAppliedAmount` |
| `CREDIT_APPLICATION_COUNTED_AS_DISCOUNT` | `hasCreditApplicationDiscountRows = true` |
| `AR_RECEIVABLE_MISMATCH` | `arInvoiceOutstandingAmount ≠ null && arReceivableAmount mismatch` |
| `TAX_DOCUMENT_TOTAL_MISMATCH` | `hasTaxDocumentAmountMismatch = true` |
| `LEGACY_FIELD_USED_IN_SUMMARY` | `usedHeaderTotalFallback = true` |
| `REFUND_SOURCE_UNCLASSIFIED` | `hasUnclassifiedRefundSource = true` |
| `PAYMENT_TARGET_UNCLASSIFIED` | `hasAmbiguousHistoricalPaymentRow = true` |

---

## Implementation Notes

- `buildWarningCodes` uses `tolerance = 0.001` with strict `>` comparison
- JavaScript float precision: `100.001 - 100 = 0.0010000000000005116` which is strictly `> 0.001`. Tests use `100.0009` (difference = 0.0009) to safely test the below-tolerance case
- `GIFT_CARD_DOUBLE_COUNTED` requires both `giftCardAppliedAmount > 0` AND `totalCreditAppliedAmount + tolerance < giftCardAppliedAmount` — the credit total must be meaningfully less than the gift card amount

---

## Verification

- `npm run test -- --testPathPattern=order-financial-warning-codes` — 29/29 ✓
- `npm run test` full sweep — 0 regressions ✓
