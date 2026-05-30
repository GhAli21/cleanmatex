# Fix Gift Card Amount Semantics, Snapshot Consistency, and Order_Fin Documentation

## Summary
Implement the finance decision that gift card redemption is a stored-value credit application, never a pricing discount. After the change:

- `order.total` / order sale total = full sale value after commercial discounts, tax, and rounding only
- gift card remains in `org_order_credit_apps_dtl` and contributes to `total_credit_applied_amount`
- `outstanding_amount = total - total_paid_amount - total_credit_applied_amount (+ processed refunds where applicable)`
- AR invoice amount for `CREDIT_INVOICE` orders must equal the post-settlement outstanding receivable
- existing affected orders must be repaired with a conservative, preview-first SQL migration
- all related documentation must be refreshed so the new semantics are explicit and discoverable

## Implementation Changes

### 1. Canonical financial semantics
- Treat these as **pricing-side** only:
  - manual discounts
  - promo/coupon/campaign discounts
  - tax/VAT/additional tax
  - rounding
- Treat these as **settlement-side** only:
  - gift card
  - wallet
  - advance
  - customer credit
  - credit note
  - loyalty credit
- Lock the canonical meanings:
  - `total` / `finalTotal` = sale total before settlement credits
  - `total_credit_applied_amount` = canonical sum of stored-value / credit applications
  - `gift_card_applied_amount` = legacy/source-specific informational field only, never an extra formula input
  - `total_discount_amount` = canonical persisted discount total
  - `total_tax_amount` = canonical persisted tax total

### 2. Calculation-layer changes
- Update `web-admin/lib/services/order-calculation.service.ts`:
  - still validate and compute `giftCardApplied`
  - stop subtracting `giftCardApplied` from `finalTotal`
  - keep tax base and tax totals unchanged by gift card
  - add explicit interface comments that `finalTotal` is full sale total before stored-value settlement
- Update any adapter using `OrderCalculationResult.finalTotal` so it now means full sale total, not amount due.
- Do not rename `finalTotal` in this batch unless there is near-zero blast radius; add comments now and leave rename for a later refactor.

### 3. Order create/update persistence
- Update order create and edit flows so persisted `org_orders_mst.total` always stores the corrected full sale total from the calculation service.
- Ensure no create/update path writes a gift-card-netted total into:
  - `org_orders_mst.total`
  - invoice base totals
  - report snapshots
- Audit all uses of `org_orders_mst.total` and `OrderCalculationResult.finalTotal` touched by order creation, update, submit, settlement, and invoice creation to ensure they now consistently mean “full sale total before settlement credits.”

### 4. Submit-order, settlement, and AR sizing
- Update `order-submit-orchestrator.service.ts` so receivable sizing subtracts all settlement credits, including gift card, from the corrected full sale total.
- Remove the current special-case assumption that gift card is already netted from `serverTotals.finalTotal`.
- Keep gift card as an `ORDER_CREDIT_APPLICATION` / stored-value leg in settlement and voucher wiring.
- Preserve `order-financial-write.service.ts` snapshot formula:
  - `outstanding = total - paid - credits + processedRefunds`
- Recalculate and persist:
  - `total_paid_amount`
  - `total_credit_applied_amount`
  - `outstanding_amount`
  - `net_receivable_amount`
  - `payment_status`
  - `pay_on_collection_amount`
- Payment-status recalculation must follow corrected amounts, not preserve stale legacy values.

### 5. AR invoice and AR card behavior
- Preserve AR invoice rows that are already correct.
- Update the financial summary read-model/UI rule:
  - if AR invoice exists, AR receivable amount = `org_invoice_mst.outstanding_amount`
  - else if payment type is `CREDIT_INVOICE`, AR receivable amount = `org_orders_mst.outstanding_amount`
  - else AR receivable amount = `0`
- Add an `AR_RECEIVABLE_MISMATCH` warning in the financial summary/debug path when:
  - AR invoice exists
  - invoice outstanding differs from order outstanding beyond tolerance
- This warning is diagnostic only; it must not replace the backend repair.

### 6. Discount/tax double-counting guards
- Inspect and correct any formulas or mappers that combine legacy and canonical fields incorrectly, especially:
  - `discount` + `promo_discount_amount` + `total_discount_amount`
  - `tax` + `vat_amount` + `total_tax_amount`
  - `total_credit_applied_amount` + `gift_card_applied_amount`
- Standardize behavior in touched code:
  - use `total_discount_amount` or discount detail rows as canonical discount total
  - use `total_tax_amount` or tax detail rows as canonical tax total
  - never double-add `vat_amount` on top of canonical total tax
- Do not broaden into unrelated report rewrites; fix every consumer directly touched by this bug path and add explicit risk notes for untouched areas.

### 7. Refund/report risk audit
- Audit refund flows for assumptions that gift card reduced the sale price.
- If refund code uses order total, outstanding, or gift-card fields in the affected path, update it so stored-value settlement is treated as settlement, not pricing discount.
- Audit the main financial-summary/reporting consumers touched by this issue and fix any directly impacted read models.
- For wider report surfaces not changed in this batch, document the residual audit requirement in the new Order_Fin doc.

### 8. Data repair migration
- Create one new SQL migration in `supabase/migrations/` with the next valid sequence and descriptive snake_case name.
- The migration must be **preview-first** and conservative:
  - include one or more SELECT queries that identify candidate affected orders
  - scope updates only to rows confirmed to be under the old “gift card netted into total” behavior
  - do not blindly update all rows with `gift_card_applied_amount > 0`
- Repair goals for affected rows:
  - restore `org_orders_mst.total` to full sale total
  - recompute `total_credit_applied_amount`
  - recompute `outstanding_amount`
  - recompute `net_receivable_amount`
  - recompute `payment_status`
  - preserve already-correct AR invoice rows
- Include verification queries in the migration comments/docs for:
  - order vs invoice outstanding mismatches
  - before/after values on the known example order
  - counts of rows selected and rows updated
- Do not run the migration.

## Documentation Tasks

### 9. Create and refresh related documentation
- Create `docs/features/Order_Fin/Fix_29_05_2026/Fix_Order_amount_values_2905.md`.
- Include in that document:
  - final business decision
  - root cause and double-count explanation
  - known live example order `4a64e48e-d29e-45e0-9671-2dcd6a9d3c5e`
  - before/after amount tables
  - code paths changed
  - migration scope and preview-query strategy
  - validation and regression tests added
  - residual risks and follow-up audit items
- Refresh the related Order_Fin docs that describe financial semantics so they no longer imply gift card is a pricing discount.
- Refresh or append the relevant implementation/changelog/status docs in `docs/features/Order_Fin/` if they currently document the old behavior or if repo convention requires implementation logs for this class of fix.
- Refresh any directly related gift-card or AR-invoice docs that currently describe gift card as reducing amount due through pricing rather than through credit application, but keep edits tightly scoped to documents that become factually incorrect because of this fix.
- Ensure all refreshed docs consistently define:
  - sale total
  - total credit applied
  - outstanding amount
  - AR receivable amount
  - gift card as stored-value settlement, not discount

### 10. Documentation-skill pass at the end
- After code/tests/migration draft are complete, use the repository documentation skill to generate and normalize all required docs for this fix.
- The documentation-skill pass must:
  - verify the new doc location and naming
  - align terminology with existing Order_Fin documentation standards
  - ensure concise implementation notes, migration notes, and validation notes are captured
  - avoid duplicating contradictory older wording
- Treat this as the final task in the implementation sequence, after technical changes and validation are stable.

## Important Interface / Contract Notes
- `OrderCalculationResult.finalTotal` keeps its name for now but its meaning is explicitly locked to:
  - full sale total after commercial discounts, tax, and rounding
  - **not** after gift card or any settlement credit
- `giftCardApplied` remains a separate output and is the bridge to settlement/credit application logic.
- `gift_card_applied_amount` remains persisted for compatibility/reporting, but formulas must treat `total_credit_applied_amount` as canonical.
- `net_receivable_amount` should be documented in this batch as the receivable-side amount derived from corrected outstanding logic; if the codebase currently uses it ambiguously, note future rename/clarification in the new doc rather than attempting a repo-wide rename now.

## Test Plan
Add or update automated coverage for all of the following:

- **Calculation semantics**
  - gift card does not reduce `finalTotal`
  - gift card does not reduce taxable amount
  - gift card does not reduce tax amount
  - promo/manual discounts still reduce pricing totals correctly

- **Known regression case**
  - subtotal `2.000`
  - tax `0.140`
  - gift card `0.150`
  - cash `1.000`
  - payment type `CREDIT_INVOICE`
  - expected:
    - order total `2.140`
    - total paid `1.000`
    - total credits `0.150`
    - outstanding `0.990`
    - AR invoice `0.990`

- **Gift card partial without cash**
  - subtotal/tax same pattern
  - gift card partial
  - cash `0`
  - payment type `CREDIT_INVOICE`
  - outstanding and AR invoice both reflect full sale total minus gift-card credit only

- **Gift card fully covers order**
  - total credits equal full sale total
  - outstanding `0`
  - payment status `PAID`
  - no AR invoice created for zero-outstanding `CREDIT_INVOICE`/receivable path

- **Double-count protection**
  - canonical snapshot does not add `gift_card_applied_amount` on top of `total_credit_applied_amount`
  - canonical discount/tax totals are not double-counted from legacy fields

- **AR card behavior**
  - AR invoice exists: UI/view model uses invoice outstanding
  - mismatch case: warning emitted
  - no invoice + `CREDIT_INVOICE`: fallback to order outstanding
  - non-AR payment types: AR receivable shows zero

- **Migration verification support**
  - if there is a migration SQL test harness or snapshot-test pattern available, add verification coverage for preview selection logic; otherwise document the verification queries and expected outputs in the new doc

Validation to run after implementation:
- targeted Jest tests for calculation, AR invoice, order financial snapshot, and financial summary mapping
- `npm run build` in `web-admin`
- any normal type/lint commands already required by the affected package, as long as they do not mutate tracked files

## Assumptions and Defaults
- The AR invoice `ARI-000016` for the known example is treated as already correct and must not be rewritten by the repair migration.
- Gift card remains a settlement credit everywhere; there is no fallback option that excludes `GIFT_CARD` from `total_credit_applied_amount`.
- This batch fixes the root cause and the directly affected financial summary/AR path; broader reporting audits beyond touched consumers may remain as documented follow-up if not directly implicated by the failing tests or traced bug path.
- The migration is created for review only and is not executed by the agent.
