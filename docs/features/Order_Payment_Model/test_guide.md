# Payment Modal V4 Test Guide

## Overview

This guide verifies the Payment Modal V4 overpayment and cash-change contract across UI behavior, checkout payload validation, settlement planning, later collection, and financial/cash drawer outcomes.

The canonical live DB model is:

- Real payment gateway method: `PAYMENT_GATEWAY` with provider stored in `gateway_code`.
- Deprecated provider rows: `HYPERPAY`, `PAYTABS`, `STRIPE` are not checkout payment method codes.
- Stored-value method and credit codes: `GIFT_CARD`, `WALLET`, `ADVANCE`, `CREDIT_NOTE`, `LOYALTY_POINTS`.

## Automated Validation

Run from `web-admin/`:

```powershell
npm test -- --runTestsByPath `
  __tests__/features/orders/payment-modal-v4.utils.test.ts `
  __tests__/features/orders/payment-modal-v4.right-rail.test.ts `
  __tests__/features/orders/use-order-submission.price-override.test.ts `
  __tests__/features/orders/build-overpayment-resolution.test.ts `
  __tests__/integration/checkout-multi-payment.test.ts `
  __tests__/services/order-settlement-planner.service.test.ts `
  __tests__/services/settlement.service.test.ts `
  __tests__/services/voucher-line.service.test.ts `
  __tests__/services/order-submit-orchestrator.unpaid-balance.test.ts `
  __tests__/services/overpayment-resolution-validator.service.test.ts `
  __tests__/services/customer-receipt-allocation.service.test.ts `
  __tests__/payments/collection-overpayment.test.ts `
  __tests__/constants/settlement-catalog.test.ts
npm run check:i18n
npm run build
```

Expected result:

- Focused tests pass.
- EN/AR i18n parity passes.
- Production build passes.

## Live DB Preconditions

Before manual testing, verify tenant payment config from `org_payment_methods_cf`, not only `sys_payment_method_cd`.

```sql
SELECT
  payment_method_code,
  gateway_code,
  payment_nature,
  credit_application_type,
  is_enabled,
  allowed_in_pos,
  supports_change_return,
  supports_overpayment,
  requires_cash_drawer
FROM org_payment_methods_cf
WHERE is_active = true
  AND rec_status = 1
ORDER BY display_order;
```

Required rows depend on the scenario being tested:

- Cash exact/change tests require `CASH` enabled and `allowed_in_pos = true`.
- Card/bank/mobile/check tests require their matching method enabled.
- Gateway tests require `PAYMENT_GATEWAY` enabled with the target `gateway_code`.
- Stored-value tests require the relevant method: `WALLET`, `ADVANCE`, `CREDIT_NOTE`, `LOYALTY_POINTS`, or `GIFT_CARD`.
- Cash drawer tests require `requires_cash_drawer = true` on the effective cash config and an open drawer session for the selected branch/user.

## Manual Test Scenarios

### 1. Cash Exact Payment

Setup:

- `CASH.supports_change_return = true` or `false`.
- Order sale total example: `8.321`.

Steps:

1. Create or open a new order with sale total `8.321`.
2. Open Payment Modal V4.
3. Select `CASH`.
4. Enter cash tendered `8.321`.
5. Submit payment.

Expected:

- Applied amount: `8.321`.
- Cash tendered: `8.321`.
- Change returned: `0.000`.
- Unresolved overpayment: `0.000`.
- Order is fully settled.
- Cash drawer movement, when required, records retained cash `8.321`.

### 2. Cash Over-Tender With Change Allowed

Setup:

- `CASH.supports_change_return = true`.

Steps:

1. Use an order with sale total `8.321`.
2. Select `CASH`.
3. Enter cash tendered `8.821`.
4. Review right rail and confirmation dialog.
5. Submit payment.

Expected:

- Applied amount: `8.321`.
- Cash tendered: `8.821`.
- Change returned: `0.500`.
- Unresolved overpayment: `0.000`.
- Total settled now uses applied amount, not gross tendered cash.
- Order is fully settled, not overpaid.
- Cash drawer movement records retained cash `8.321`, not `8.821`.

### 3. Cash Over-Tender With Change Blocked

Setup:

- `CASH.supports_change_return = false`.

Steps:

1. Use an order with sale total `8.321`.
2. Select `CASH`.
3. Try to enter cash tendered `8.821`.
4. Attempt submit if UI allows the draft.

Expected:

- Submit is blocked.
- Backend/service error is `CASH_CHANGE_NOT_ALLOWED`.
- No payment rows, voucher lines, or cash drawer movement are created.

### 4. Non-Cash Overpayment Blocked

Setup:

- Use `CARD`, `BANK_TRANSFER`, `MOBILE_PAYMENT`, `CHECK`, or `PAYMENT_GATEWAY`.
- Effective method has `supports_overpayment = false`.

Steps:

1. Use an order with sale total `8.321`.
2. Select the non-cash method.
3. Enter amount `8.821`.
4. Submit.

Expected:

- Submit is blocked with `METHOD_OVERPAYMENT_NOT_ALLOWED`.
- No retained overpayment is posted.
- No financial snapshot overpayment is created.

### 5. Retained Non-Cash Overpayment Allowed

Setup:

- Choose a non-cash method that intentionally supports retained overpayment.
- Set effective `supports_overpayment = true`.

Steps:

1. Use an order with sale total `8.321`.
2. Select the method.
3. Enter amount `8.821`.
4. Submit.

Expected:

- Payment is accepted.
- Applied payment amount is `8.821`.
- Retained overpayment is `0.500`.
- Financial snapshot shows overpayment only for the retained excess.

### 6. Gift Card Plus Cash Change

Setup:

- Gift card redemption available.
- `CASH.supports_change_return = true`.

Steps:

1. Use an order with sale total `8.321`.
2. Apply gift card amount `2.000`.
3. Select `CASH`.
4. Enter cash tendered `6.821`.
5. Submit.

Expected:

- Gift card applied: `2.000`.
- Cash applied: `6.321`.
- Cash tendered: `6.821`.
- Change returned: `0.500`.
- Unresolved overpayment: `0.000`.
- Total settled now equals `8.321`.

### 7. Wallet or Stored-Value Cap

Setup:

- Customer has balance in `WALLET`, `ADVANCE`, open `CREDIT_NOTE`, or `LOYALTY_POINTS`.
- For credit notes, ensure `org_customer_credit_notes` (or stored-value API) returns open notes.

Steps:

1. Use an order with sale total `8.321`.
2. Select a stored-value method.
3. For `CREDIT_NOTE`, confirm picker opens and select a note.
4. Observe default/suggested amount.
5. Try entering an amount above live balance or remaining due.

Expected:

- Suggested amount is capped to `min(remaining due, live balance)`.
- Validation rail shows balance-exceeded message when over cap.
- `CREDIT_NOTE` requires `creditReferenceId` before submit.
- Submit payload includes `creditReferenceId` on the leg.

### 8. Multi-Cash Change Policy

Setup:

- Two cash method configs (or split into two cash legs if product allows duplicate method legs).
- Leg A: `supports_change_return = true`.
- Leg B: `supports_change_return = false`.

Steps:

1. Use an order with sale total `10.000`.
2. Add cash leg A amount `6.000` (change allowed).
3. Add cash leg B amount `5.000` (change disallowed) — total settled exceeds sale total.
4. Review right rail.

Expected:

- Aggregate change is **not** shown as returned change.
- Unresolved overpayment appears until amounts are adjusted.
- Submit blocked until overpayment is resolved.

### 9. Check Due Date Validation

Setup:

- `CHECK` enabled in POS.

Steps:

1. Add a check leg with valid check number.
2. Set due date to yesterday (or paste an invalid date).
3. Attempt submit.

Expected:

- Inline error on check date field (`checkDateInPast` or `checkDateInvalid`).
- Validation rail lists the error.
- Focus shortcut scrolls to check date input.
- Server Zod validation rejects past dates on submit if client bypassed.

### 10. Payment Terminal Required

Setup:

- `CARD` (or other method) with `requires_terminal = true` in `org_payment_methods_cf`.
- Active payment terminals seeded for branch.

Steps:

1. Select the terminal-required method.
2. Leave terminal unselected.
3. Attempt submit.

Expected:

- Leg workspace shows terminal dropdown with required indicator.
- Validation rail: terminal required message.
- Submit blocked until terminal selected.
- Payload leg includes `terminalId`; voucher line gets `payment_terminal_id`.

### 11. Gift Card + NONE Outstanding Policy

Setup:

- Gift card redemption enabled.
- Outstanding policy set to `NONE` (full settlement required).

Steps:

1. Order sale total `100.000`.
2. Apply gift card `30.000`.
3. Add cash leg `70.000`.
4. Submit.
5. Repeat with cash leg `60.000` only.

Expected:

- Scenario A: submit succeeds (gift 30 + cash 70 covers 100).
- Scenario B: submit blocked — remainder validation or `OUTSTANDING_POLICY_REQUIRED`.

### 12. Price Override on Create Order

Steps:

1. Create new order with at least one line.
2. Override line price (with permission).
3. Open payment modal; confirm preview sale total reflects override.
4. Submit order; inspect network payload or order line rows.

Expected:

- Preview API receives `priceOverride` on items.
- Submit `items[]` includes `priceOverride`, `overrideReason`, `overrideBy` when override applied.

### 13. Split Payment Reconciliation

Steps:

1. Use an order with sale total `10.000`.
2. Add `CASH` amount `4.000`.
3. Add `CARD` amount `6.000`.
4. Change the order total or discount so sale total becomes `8.000`.
5. Reopen or refresh the modal state if needed.

Expected:

- Legs reconcile down to the new sale total.
- Active/default amount reflects remaining balance.
- No hidden overpayment remains unless a method explicitly supports retained overpayment.

### 14. Payment Gateway Method

Setup:

- `org_payment_methods_cf.payment_method_code = 'PAYMENT_GATEWAY'`.
- `gateway_code` identifies provider, for example `HYPERPAY`.

Steps:

1. Select the gateway option in Payment Modal V4.
2. Submit exact amount.
3. Confirm backend payload uses method `PAYMENT_GATEWAY` with `gateway_code`.

Expected:

- Gateway row resolves by both method code and gateway code.
- Payment status follows configured default status or gateway processing fallback.
- Overpayment is blocked unless `PAYMENT_GATEWAY.supports_overpayment = true`.

### 15. Later Collection Policy

Steps:

1. Create an order with deferred balance, such as `PAY_ON_COLLECTION` or `PAY_ON_DELIVERY`.
2. Open later payment collection.
3. Collect exact cash and submit.
4. Repeat with cash over-tender under both change-allowed and change-blocked configs.
5. Repeat with non-cash overpayment.

Expected:

- Later collection enforces the same cash and overpayment rules as new-order submit.
- Branch drawer override is respected when configured.
- Cash drawer movement records retained cash amount only.

### 16. Extra Receipt Card — Adjust Legs (Phase 2)

Setup:

- Multi-cash or non-cash scenario where `unresolvedOverpaymentAmount > 0` (see scenario 8).
- Linked customer optional.

Steps:

1. Open Payment Modal V4 with excess that cannot auto-resolve as change or retained overpayment.
2. Confirm **Extra Receipt Handling** card appears with unallocated amount.
3. Leave mode on **Adjust payment amounts**.
4. Reduce leg amounts until unallocated = `0.000`.
5. Submit.

Expected:

- Submit enabled only when unallocated is zero.
- No `overpaymentResolution` in payload when excess is fully adjusted away.
- Order `overpaid_amount` remains `0.000`.

### 17. Save Excess as Customer Advance (Phase 3)

Setup:

- Customer linked on order.
- Unresolved excess (e.g. two cash legs, one with `supports_change_return = false`).
- Permission `orders:overpayment_to_advance` for cashier role.

Steps:

1. Trigger unresolved excess on a linked customer order.
2. Select **Save as customer advance** on Extra Receipt card.
3. Submit order.

Expected:

- Payload includes `overpaymentResolution.lines[]` with `SAVE_AS_CUSTOMER_ADVANCE`.
- Row in `org_fin_overpay_disp_dtl` with matching `resolution_code` and `amount`.
- Customer advance balance increases by excess amount.
- Order financial snapshot `overpaid_amount = 0.000` after disposition.

### 18. Save Excess as Customer Credit (Phase 3)

Setup:

- Same as scenario 17, with `orders:overpayment_to_credit`.

Steps:

1. Select **Save as customer credit**.
2. Submit.

Expected:

- Payload line `SAVE_AS_CUSTOMER_CREDIT`.
- Open credit note issued via stored-value service.
- Audit row in `org_fin_overpay_disp_dtl` with `target_ref` = credit note id.

### 19. Server Rejects Missing Resolution (Phase 2)

Setup:

- Unresolved excess scenario.

Steps:

1. Bypass UI validation (devtools) and submit without `overpaymentResolution`.

Expected:

- HTTP 400 with `OVERPAYMENT_RESOLUTION_REQUIRED`.
- No order committed (or idempotent replay only).

### 20. Auto Allocate to Open Balances — Preview + Submit (Phase 4)

Setup:

- Customer with at least one open AR invoice or order balance (different from current order).
- Tenant policy seeded: `org_fin_rcpt_alloc_policy_cf` (`DEFAULT_OLDEST_DUE`).
- Permission `orders:overpayment_allocate`.
- Unresolved excess on current checkout.

Steps:

1. Open Extra Receipt card → **Auto allocate to open balances**.
2. Review auto-allocation preview drawer (documents + amounts).
3. Confirm allocation (preview status → `CONFIRMED`).
4. Submit order.

Expected:

- Preview API: `POST /api/v1/customer-receipts/allocation/preview-auto`.
- Confirm API: `POST /api/v1/customer-receipts/allocation/post` with `confirmOnly: true`.
- Submit payload includes `AUTO_ALLOCATE_TO_CUSTOMER_BALANCES` + `allocationPreviewId`.
- Target invoice `paid_amount` / `outstanding_amount` updated OR target order receives allocation payment.
- Fallback remainder posts to customer advance when no targets.
- Preview row `preview_status = POSTED` after submit.
- Audit rows in `org_fin_overpay_disp_dtl` per allocation line.

### 21. AR Invoice Wins Over Order (Phase 4)

Setup:

- Customer has an old order with linked AR invoice still open.
- Same customer has another open order balance without invoice.

Steps:

1. Run auto allocation preview for excess amount covering both.

Expected:

- Allocation targets invoice (`AR_INVOICE` / `INVOICE_PAYMENT`), not the underlying order.
- Open-balances API excludes order when invoice still owns balance.

### 22. Manual Allocate (Phase 4)

Setup:

- Customer with multiple open targets.
- Unresolved excess.

Steps:

1. Select **Manual allocate**.
2. Enter amounts on selected documents summing exactly to excess.
3. Confirm preview → submit order.

Expected:

- `POST /api/v1/customer-receipts/allocation/preview-manual` with balanced lines.
- Submit blocked until manual sum equals excess.
- Payload uses `ALLOCATE_TO_CUSTOMER_BALANCES` + confirmed `allocationPreviewId`.

### 23. Allocation Blocked — Unallocated Remainder

Setup:

- Policy fallback = `BLOCK_AND_REQUIRE_MANUAL_ACTION` **or** manual lines sum < excess.

Steps:

1. Attempt confirm/submit with `remainingUnallocatedAmount > 0`.

Expected:

- UI blocks confirm button.
- Server returns `RECEIPT_ALLOCATION_EXCESS_UNRESOLVED` if bypassed.

### 24. Walk-In Customer — No Stored-Value / Allocate Options

Setup:

- No customer linked.

Steps:

1. Create unresolved excess.

Expected:

- Extra Receipt card shows adjust-legs hint only (no advance/credit/allocate buttons).
- Submit blocked until legs adjusted.

### 25. Idempotent Submit Replay (Allocation)

Setup:

- Complete scenario 20 successfully; note `idempotencyKey`.

Steps:

1. Replay same submit payload with same idempotency key.

Expected:

- No duplicate allocation payments or duplicate `org_fin_overpay_disp_dtl` rows for same idempotency keys.
- Preview remains `POSTED`.

### 26. Later Collection — Overpayment Resolution Parity (Phase 5)

Setup:

- Existing `PAY_ON_COLLECTION` order with outstanding `50.000`.
- Customer linked on order.
- `CARD` with `supports_overpayment = false`.

Steps:

1. Call `POST /api/v1/orders/{id}/payments` (or `/collect-payment`) with leg amount `55.000` and **no** `overpaymentResolution`.
2. Confirm API returns `OVERPAYMENT_RESOLUTION_REQUIRED`.
3. Repeat with `overpaymentResolution` saving `5.000` as customer advance:

```json
{
  "paymentLegs": [{ "paymentMethodId": "<CARD_METHOD_ID>", "amount": 55 }],
  "overpaymentResolution": {
    "excessAmount": 5,
    "lines": [{ "resolutionCode": "SAVE_AS_CUSTOMER_ADVANCE", "amount": 5 }]
  },
  "idempotencyKey": "collect-test-001"
}
```

Expected:

- Collection succeeds; order outstanding becomes `0`.
- `org_fin_overpay_disp_dtl` row for `SAVE_AS_CUSTOMER_ADVANCE` amount `5.000`.
- Customer advance balance increases by `5.000`.
- Order `overpaid_amount = 0` after financial recalculation.

### 27. Later Collection — Cash Change (unchanged baseline)

Setup:

- `PAY_ON_COLLECTION` order outstanding `50.000`.
- `CASH.supports_change_return = true`.

Steps:

1. Collect with `amount: 50`, `cashTendered: 51`.
2. Verify drawer movements.

Expected:

- `CASH_SALE` movement amount `50.000` (retained, not `51`).
- `CASH_OUT` change movement `1.000`.
- No overpayment resolution required.

## Post-Submit Data Checks

Use these checks against the created order after submit.

```sql
SELECT
  payment_method_code,
  gateway_code,
  amount,
  tendered_amount,
  change_returned_amount,
  payment_status
FROM org_order_payments_dtl
WHERE order_id = '<ORDER_ID>'
ORDER BY created_at;
```

Expected:

- `amount` is the applied amount.
- `tendered_amount` is populated for cash only.
- `change_returned_amount` is populated only when cash change is returned.

```sql
SELECT
  credit_type,
  applied_amount,
  credit_reference_id,
  application_status
FROM org_order_credit_apps_dtl
WHERE order_id = '<ORDER_ID>'
ORDER BY created_at;
```

Expected:

- Stored-value rows use canonical credit types such as `WALLET`, `ADVANCE`, `CREDIT_NOTE`, `LOYALTY_POINTS`, or `GIFT_CARD`.
- Stored-value amounts do not exceed the remaining due balance.
- `CREDIT_NOTE` rows reference the selected note id.

```sql
SELECT
  id,
  terminal_code,
  terminal_name,
  branch_id,
  is_active
FROM org_payment_terminals_cf
WHERE tenant_org_id = '<TENANT_ID>'
  AND is_active = true;
```

Expected when terminal required:

- Submit payload leg includes matching `terminalId`.
- Voucher/payment row stores `payment_terminal_id`.

```sql
SELECT
  movement_type,
  amount,
  direction,
  order_payment_id
FROM org_cash_drawer_movements_dtl
WHERE order_id = '<ORDER_ID>'
ORDER BY created_at;
```

Expected:

- Cash sale movement amount equals retained cash applied to the order.
- Gross tendered cash is not recorded as drawer revenue when change is returned.

```sql
SELECT
  resolution_code,
  amount,
  currency_code,
  target_ref,
  voucher_id,
  idempotency_key,
  created_at
FROM org_fin_overpay_disp_dtl
WHERE tenant_org_id = '<TENANT_ID>'
  AND order_id = '<ORDER_ID>'
  AND is_active = true
ORDER BY created_at;
```

Expected (Phase 2–4):

- One row per disposition/allocation line (`SAVE_AS_CUSTOMER_*`, `AUTO_ALLOCATE_TO_CUSTOMER_BALANCES`, etc.).
- Sum of `amount` equals checkout excess routed away from `overpaid_amount`.
- `target_ref` populated for advance/credit/invoice allocation effects.

```sql
SELECT
  id,
  customer_id,
  excess_amount,
  amount_allocated,
  remaining_unallocated_amount,
  allocation_mode,
  fallback_destination,
  preview_status,
  preview_payload
FROM org_fin_rcpt_alloc_preview_tr
WHERE tenant_org_id = '<TENANT_ID>'
  AND source_order_id = '<ORDER_ID>'
ORDER BY created_at DESC;
```

Expected (Phase 4):

- Preview exists after auto/manual confirm in UI.
- `remaining_unallocated_amount = 0` before submit.
- After submit: `preview_status = POSTED`.

```sql
SELECT overpaid_amount, total_paid_amount, outstanding_amount
FROM org_orders_mst
WHERE id = '<ORDER_ID>';
```

Expected:

- After advance/credit/allocation disposition, `overpaid_amount = 0` when excess fully resolved.

```sql
SELECT policy_code, allocation_mode, fallback_destination, is_default
FROM org_fin_rcpt_alloc_policy_cf
WHERE tenant_org_id = '<TENANT_ID>'
  AND is_active = true;
```

Expected:

- At least one default policy (e.g. `DEFAULT_OLDEST_DUE`) for allocation scenarios.

## Regression Checklist

- Amount Editor defaults to remaining balance when a method is selected.
- Total Settled Now excludes returned cash change.
- Cash change does not show as overpaid amount.
- Non-cash excess is blocked unless method policy explicitly allows retained overpayment.
- `PAYMENT_GATEWAY` works with provider-specific `gateway_code`.
- Stored-value canonical codes match DB values.
- EN/AR labels are present for Applied and Cash Tendered.
- Gift card + cash with `NONE` policy submits when legs + gift cover sale total.
- Credit note picker applies a note and caps leg amount to note balance.
- Terminal-required methods block submit until terminal is selected.
- Create order with price override sends override fields on line items.
- Check due date past/invalid blocked client and server.
- Multi-cash: unresolved overpayment when any cash leg disallows change.
- Extra Receipt card appears for unresolved excess; adjust-legs clears block.
- Save as advance/credit posts audit + stored-value (linked customer only).
- Auto/manual allocation preview → confirm → submit embeds `allocationPreviewId`.
- Open balance query prefers AR invoice over linked order.
- Submit hook shows localized messages for infrastructure error codes.
- Build and focused tests pass.

## Submit Error Code Quick Reference

| Server code | When |
|-------------|------|
| `OUTSTANDING_POLICY_REQUIRED` | NONE policy with remaining balance |
| `PAYMENT_TERMINAL_REQUIRED` | Terminal-required method without `terminalId` |
| `PAYMENT_REFERENCE_REQUIRED` | Reference-required method without ref/auth |
| `CREDIT_REFERENCE_REQUIRED` | CREDIT_NOTE without `creditReferenceId` |
| `CASH_CHANGE_NOT_ALLOWED` | Cash tendered > applied, change disabled |
| `METHOD_OVERPAYMENT_NOT_ALLOWED` | Non-cash amount > due, overpayment disabled |
| `OVERPAYMENT_RESOLUTION_REQUIRED` | Unresolved excess, no resolution payload |
| `OVERPAYMENT_RESOLUTION_MISMATCH` | Line sum ≠ excess or preview amount mismatch |
| `OVERPAYMENT_RESOLUTION_NOT_ALLOWED` | Resolution code blocked for context |
| `RECEIPT_ALLOCATION_EXCESS_UNRESOLVED` | Allocation preview not fully allocated |
| `RETURN_CHANGE_EXCEEDS_CAPACITY` | Change line exceeds leg/cash capacity |
| `RETURN_CHANGE_LEG_INVALID` | Change resolution on invalid leg |
| `B2B_CREDIT_HOLD` / `B2B_CREDIT_EXCEEDED` | B2B credit limits |
| `SPLIT_AMOUNT_MISMATCH` | Leg sum ≠ amount to charge |
| `DEFERRED_LEG_NOT_ALONE` | Deferred method combined with other legs |

UI messages: `newOrder.payment.errors.*` (EN/AR). Check date Zod errors: `newOrder.payment.splitPayment.checkDate*`.
