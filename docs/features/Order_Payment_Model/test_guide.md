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
npm test -- --runTestsByPath __tests__/features/orders/payment-modal-v4.utils.test.ts __tests__/features/orders/payment-modal-v4.right-rail.test.ts __tests__/integration/checkout-multi-payment.test.ts __tests__/services/order-settlement-planner.service.test.ts __tests__/services/settlement.service.test.ts
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

- Customer has enough balance in `WALLET`, `ADVANCE`, `CREDIT_NOTE`, or `LOYALTY_POINTS`.

Steps:

1. Use an order with sale total `8.321`.
2. Select a stored-value method with available balance greater than the due amount.
3. Observe default amount.
4. Try entering an amount above the remaining due.

Expected:

- Suggested amount is capped to the remaining order balance.
- Stored-value leg cannot create retained overpayment.
- `CREDIT_NOTE` requires a selected credit reference before submission.

### 8. Split Payment Reconciliation

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

### 9. Payment Gateway Method

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

### 10. Later Collection Policy

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

## Regression Checklist

- Amount Editor defaults to remaining balance when a method is selected.
- Total Settled Now excludes returned cash change.
- Cash change does not show as overpaid amount.
- Non-cash excess is blocked unless method policy explicitly allows retained overpayment.
- `PAYMENT_GATEWAY` works with provider-specific `gateway_code`.
- Stored-value canonical codes match DB values.
- EN/AR labels are present for Applied and Cash Tendered.
- Build and focused tests pass.
