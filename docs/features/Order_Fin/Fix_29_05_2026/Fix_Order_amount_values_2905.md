# Fix Order Amount Values 2905

## Overview

This fix resolves the order-finance contradiction where gift card redemption was treated both as:

- a pricing reduction that lowered `org_orders_mst.total`
- and a stored-value credit application that lowered `outstanding_amount` again through `total_credit_applied_amount`

The final business rule is now explicit:

- gift card is stored-value settlement
- gift card must not reduce sale total
- sale total must remain the full value after commercial discounts, tax, and rounding only
- outstanding must be reduced by payments and credit applications only

## Confirmed Example

Known order:

- `order_id = 4a64e48e-d29e-45e0-9671-2dcd6a9d3c5e`
- AR invoice `ARI-000016`

Before fix:

| Field | Old value | Why it was wrong |
|---|---:|---|
| Base services | 2.000 | correct |
| Tax | 0.140 | correct |
| Gift card | 0.150 | valid credit application |
| Cash | 1.000 | valid payment |
| Order total | 1.990 | wrong because gift card was subtracted from sale total |
| Total credits applied | 0.150 | correct |
| Outstanding | 0.840 | wrong because gift card was counted twice |
| AR invoice outstanding | 0.990 | correct business truth |

Correct values after fix:

| Field | Correct value |
|---|---:|
| Order total | 2.140 |
| Total paid | 1.000 |
| Total credits applied | 0.150 |
| Outstanding | 0.990 |
| AR receivable | 0.990 |

Canonical formula:

```text
total_amount = items_base_amount + total_charges_amount - total_discount_amount + total_tax_amount + rounding_adjustment_amount
outstanding_amount = total_amount - total_paid_amount - total_credit_applied_amount + processed_refunds
```

## What Changed

### Code changes

Updated pricing semantics so gift card no longer reduces `finalTotal`:

- `web-admin/lib/services/order-calculation.service.ts`
- `web-admin/lib/services/invoice-service.ts`
- `web-admin/src/features/orders/ui/payment-modal-v3.tsx`
- `web-admin/src/features/orders/ui/payment-modal-v4.tsx`
- `web-admin/src/features/orders/ui/payment-modal-enhanced-02.tsx`

Updated settlement / AR sizing so every credit application, including gift card, reduces outstanding through settlement math:

- `web-admin/lib/services/order-submit-orchestrator.service.ts`

Updated financial-summary read model so AR receivable prefers invoice outstanding when invoice exists, and emits a mismatch warning when order and invoice drift:

- `web-admin/src/features/orders/lib/map-order-financial-summary-view.ts`
- `web-admin/messages/en.json`
- `web-admin/messages/ar.json`

### Tests added or updated

- `web-admin/__tests__/services/order-calculation.service.test.ts`
  - gift card no longer reduces `finalTotal`
  - gift card does not change tax base or tax amount
- `web-admin/__tests__/services/ar-invoice.service.test.ts`
  - regression case now pins `2.140 - 1.000 - 0.150 = 0.990`
- `web-admin/__tests__/features/orders/map-order-financial-summary-view.test.ts`
  - AR receivable uses invoice outstanding when invoice exists
  - warning emitted when invoice outstanding and order outstanding diverge

## Migration / Backfill

Created preview-first repair migration:

- `supabase/migrations/0331_fix_gift_card_order_amount_semantics.sql`

Migration strategy:

- identify only orders with:
  - `gift_card_applied_amount > 0`
  - active `GIFT_CARD` rows in `org_order_credit_apps_dtl`
  - a header total that reconstructs correctly when current total + gift card amount is compared against the header's own subtotal/charges/discount/tax/rounding components
- recompute:
  - `total`
  - `total_charges_amount`
  - `total_discount_amount`
  - `total_tax_amount`
  - `total_paid_amount`
  - `total_credit_applied_amount`
  - `net_receivable_amount`
  - `outstanding_amount`
  - `payment_status`
  - `pay_on_collection_amount`
  - `change_returned_amount`
- preserve already-correct AR invoice rows

The migration contains:

- candidate preview SELECT
- known-order verification SELECT
- scoped UPDATE
- post-update verification SELECT for order vs invoice outstanding

## Related Documentation Refreshed

Refreshed repo docs that still described the old model:

- `docs/features/Order_Fin/IMPLEMENTATION_STATUS.md`
- `docs/features/Order_Fin/bvm_wiring_phase2_implementation.md`

Related ADRs already align with the new model and were left as-is:

- `docs/features/Order_Fin/ADR/ADR-001-order-total-full-sale-value.md`
- `docs/features/Order_Fin/ADR/ADR-002-gift-card-credit-application-not-discount.md`
- `docs/features/Order_Fin/ADR/ADR-019-conservative-gift-card-backfill.md`
- `docs/features/Order_Fin/ADR/ADR-024-refund-respects-stored-value.md`

## Refund / Report Audit

Reviewed refund and cancellation paths:

- `web-admin/lib/services/order-cancel-service.ts`
- `web-admin/lib/services/order-refund.service.ts`

Outcome:

- no direct pricing-side gift-card subtraction was found in those paths
- cancellation already restores gift card from payment-linked usage rows
- refund balance logic uses paid + credit totals, which stays consistent with the corrected header semantics

No refund code change was required in this batch.

## Validation

Completed validation:

- `npm test -- __tests__/services/order-calculation.service.test.ts __tests__/services/ar-invoice.service.test.ts __tests__/features/orders/map-order-financial-summary-view.test.ts --runInBand`
- `npm run check:i18n`
- `npm run build`

## Residual Risks / Follow-up

- Existing historical rows remain incorrect until the new migration is reviewed and applied by the user.
- Other report surfaces that rely directly on legacy `org_orders_mst.total` snapshots should be watched after backfill, even though the directly affected Order Fin summary path is fixed here.
- `gift_card_applied_amount` remains a compatibility field; formulas must continue to treat `total_credit_applied_amount` as canonical.
