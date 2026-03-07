# Cancel Order and Return Order — Product Requirements

**Last updated:** 2026-03-06

## Overview

Two distinct flows for voiding orders:

1. **Cancel Order** — Order voided **before** customer receives items. No physical return.
2. **Return Order** — Customer comes to facility with items they received; order voided + refund.

## Requirements

### Cancel Order

- Require cancellation reason (min 10 chars) for audit and analytics
- Record who cancelled and when (`cancelled_at`, `cancelled_by`, `cancelled_note`)
- Optional structured reason codes: CUSTOMER_REQUEST, DUPLICATE, WRONG_ADDRESS, OUT_OF_STOCK, OTHER
- If order has payments: cancel each completed payment and reverse invoice/order balances
- Allowed statuses: draft, intake, preparation, processing, sorting, washing, drying, finishing, assembly, qa, packing, ready, out_for_delivery

### Return Order (Customer Return)

- Require return reason (min 10 chars)
- Record when customer returned and who processed (`returned_at`, `returned_by`, `return_reason`)
- Optional reason codes: CHANGED_MIND, QUALITY_ISSUE, WRONG_ITEMS, DAMAGED, OTHER
- If order has payments: refund each completed payment (full amount typical)
- **Refund rule:** No payment transaction without voucher master. Create CASH_OUT/REFUND voucher first.
- Allowed statuses: delivered, closed

## Database Schema

### org_orders_mst columns

| Column | Type | Purpose |
|--------|------|---------|
| `cancelled_at` | TIMESTAMPTZ | When order was cancelled |
| `cancelled_by` | UUID | User who cancelled |
| `cancelled_note` | TEXT | Cancellation reason (required) |
| `cancellation_reason_code` | VARCHAR(50) | Optional structured code |
| `returned_at` | TIMESTAMPTZ | When customer returned items |
| `returned_by` | UUID | Staff who processed return |
| `return_reason` | TEXT | Return reason (required) |
| `return_reason_code` | VARCHAR(50) | Optional structured code |

## Business Logic

### Cancel flow

1. Staff clicks Cancel Order
2. Dialog: reason required (textarea, min 10 chars), optional reason code
3. Validate: order status in allowed list, reason present
4. Call `cmx_ord_canceling_transition` RPC
5. For each completed payment linked to order: call `cancelPayment`
6. Log to `org_order_history`

### Return flow

1. Staff clicks Customer Return
2. Dialog: reason required, optional reason code
3. Validate: order status in delivered/closed, reason present
4. Call `cmx_ord_returning_transition` RPC
5. For each completed payment: call `refundPayment` (creates voucher first, then refund row)
6. Log to `org_order_history`

### Refund voucher rule

**Mandatory:** Every refund payment row must have `voucher_id` referencing `org_fin_vouchers_mst`.

- Voucher: `voucher_category=CASH_OUT`, `voucher_subtype=REFUND`, `voucher_type=PAYMENT`
- Numbering: `REF-YYYY-NNNNN`
- Created before refund payment row

## UI Components

- **Cancel Order** button — visible when status allows transition to cancelled (draft → out_for_delivery)
- **Customer Return** button — visible when status is delivered or closed
- **CancelOrderDialog** — reason textarea, reason code dropdown, confirm
- **CustomerReturnOrderDialog** — same structure for return

## Testing

- Cancel: reason required; works for all allowed statuses; payments cancelled
- Return: reason required; delivered/closed only; refund processed with voucher
- RLS and tenant isolation
- Bilingual (EN/AR)
