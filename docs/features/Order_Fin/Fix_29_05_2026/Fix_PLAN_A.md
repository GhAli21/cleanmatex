# Fix Gift Card Order Amount Semantics and Backfill Order_Fin Docs

## Summary
Implement the gift-card finance model as a stored-value credit application, not a pricing discount. The code change will make `order.total` represent the full sale value after commercial discounts, tax, and rounding only, while gift card redemption continues to flow through `org_order_credit_apps_dtl` and `total_credit_applied_amount`. Then repair existing affected orders with a new SQL migration, align the financial summary UI to prefer AR invoice outstanding when present, and document the whole fix in `docs/features/Order_Fin/Fix_Order_amount_values_2905.md`.

## Implementation Changes
- **Pricing and order-total semantics**
  - Update `web-admin/lib/services/order-calculation.service.ts` so gift card validation still computes `giftCardApplied`, but no longer subtracts it from `finalTotal`.
  - Keep tax, VAT, subtotal, taxable amount, and discount math unchanged except for removing gift card from the pricing side.
  - Keep `giftCardApplied` in the returned result so settlement flows still know how much stored value to apply.
  - Treat `OrderCalculationResult.finalTotal` as the full sale total after commercial discounts and tax; it is no longer “amount due after gift card”.

- **Order create/update and settlement flow**
  - Ensure every order create/update path that persists `totals.total` continues to write the recalculated sale total from the updated calculation service.
  - Update `order-submit-orchestrator.service.ts` so any “corrected outstanding” / AR sizing math subtracts all credit applications, including gift card, from the full sale total.
  - Remove the current special-case assumption that gift card is already netted from `serverTotals.finalTotal`.
  - Keep `org_order_credit_apps_dtl` creation for `GIFT_CARD` exactly as-is conceptually; do not reclassify it as a discount or payment.
  - Keep `order-financial-write.service.ts` outstanding formula unchanged:
    - `outstanding = total - total_paid_amount - total_credit_applied_amount + refunds`
  - Preserve current snapshot fields like `net_receivable_amount`, `payment_status`, and `pay_on_collection_amount`, but let them recalculate from the corrected full-sale `total`.

- **Financial summary UI and read model**
  - Update the financial summary mapper/UI so `AR receivable amount` uses:
    - `arInvoice.outstandingAmount` when an AR invoice exists
    - otherwise `order.outstanding_amount` only for `CREDIT_INVOICE`
    - otherwise `0`
  - Keep the rest of the financial summary cards sourced from the canonical order financial snapshot/read model.
  - Do not implement a UI-only band-aid; this UI change is only to make the card follow the canonical AR rule after the backend fix.

- **Data repair migration**
  - Create one new migration in `supabase/migrations/` with the next available sequence, named for gift-card order amount repair.
  - The migration should backfill existing affected orders by restoring gift-card-applied amounts into order totals and recomputing dependent snapshot columns.
  - Scope the repair to historical orders where gift card was applied under the old behavior; do not touch AR invoice rows that are already correct.
  - Recompute at minimum:
    - `org_orders_mst.total`
    - `org_orders_mst.outstanding_amount`
    - `org_orders_mst.net_receivable_amount`
    - any dependent payment-status fields if needed by the current snapshot rules
  - The migration must be SQL-only and prepared for user review; do not run it.

- **Documentation**
  - Create `docs/features/Order_Fin/Fix_Order_amount_values_2905.md`.
  - Document:
    - the business decision and final finance rule
    - the root cause of the double count
    - the live order example (`4a64e48e-d29e-45e0-9671-2dcd6a9d3c5e`)
    - the code paths changed
    - the migration/backfill strategy
    - expected before/after values
    - validation and regression coverage added

## Important Interface / Contract Changes
- `OrderCalculationResult.finalTotal` keeps the same field name but changes meaning:
  - **before:** sale total after gift card
  - **after:** sale total before stored-value settlement, after commercial discounts and tax
- `giftCardApplied` remains separate and becomes the only place in calculation results where gift-card settlement amount is represented.
- AR receivable display contract becomes:
  - prefer AR invoice outstanding when an invoice exists
  - fall back to order outstanding only when no AR invoice exists and the payment type is `CREDIT_INVOICE`

## Test Plan
- Update `web-admin/__tests__/services/order-calculation.service.test.ts`:
  - prove gift card does not reduce `finalTotal`
  - prove `giftCardApplied` is still calculated correctly
- Add or update service tests around submit-order / AR sizing:
  - subtotal `2.000` + tax `0.140` + gift card `0.150` + cash `1.000`
  - persisted order total must be `2.140`
  - total credits applied must be `0.150`
  - outstanding must be `0.990`
  - AR invoice amount must remain `0.990`
- Add a guard test for the canonical snapshot math:
  - gift card is included in `total_credit_applied_amount`
  - gift card is not subtracted a second time from `order.total`
- Update any existing tests that currently encode the old “gift card reduces finalTotal” behavior, especially AR/order-financial tests and comments that assume pricing-discount semantics.
- Validation commands after implementation:
  - targeted Jest tests for calculation, AR invoice, and financial snapshot areas
  - `npm run build` in `web-admin`
  - any relevant type/lint checks already used by the repo if they are part of the normal validation path

## Assumptions and Defaults
- The AR invoice row `ARI-000016` is treated as the correct business truth and must not be backfilled.
- Gift card remains a stored-value credit application everywhere; no fallback option will exclude `GIFT_CARD` from credit math.
- The repair is implemented as a new SQL migration file only, per repo rules; no direct DB mutation will be executed from the agent.
- The requested documentation file will live at:
  - `docs/features/Order_Fin/Fix_Order_amount_values_2905.md`
