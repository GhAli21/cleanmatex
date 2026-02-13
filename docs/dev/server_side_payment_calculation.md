# Server-Side Payment Calculation

**Status**: ✅ Implemented  
**Last Updated**: 2026-02-12

---

## Overview

Order totals are computed **server-side only**. The client fetches totals from a preview API and displays them. On submit, the server recalculates and compares; on mismatch, nothing is persisted. Order + invoice + payment are created in a **single transaction**.

**Critical rule**: Order + Invoice + Payment = One transaction. On mismatch, nothing is created.

---

## Architecture

```
Client                          Server
┌─────────────────────┐        ┌─────────────────────────────┐
│ Payment modal opens │  POST   │ /api/v1/orders/preview-     │
│ → fetch preview     │ ──────► │ payment                     │
│                     │         │ → OrderCalculationService   │
│ Display server      │ ◄────── │ → calculateOrderTotals()    │
│ totals only         │  JSON   │                             │
│                     │         │                             │
│ User confirms       │  POST   │ /api/v1/orders/create-with-  │
│ → submit            │ ──────► │ payment                     │
│                     │         │ 1. Recalculate totals       │
│                     │         │ 2. Compare w/ clientTotals  │
│                     │         │ 3a. Mismatch? → 400, diff   │
│                     │         │ 3b. Match? → create all     │
│ Success or          │ ◄────── │    in one tx                │
│ AmountMismatchDialog│  JSON   │                             │
└─────────────────────┘        └─────────────────────────────┘
```

---

## Key Components

### Services

| File | Responsibility |
|------|----------------|
| `lib/services/order-calculation.service.ts` | `calculateOrderTotals()` — pricing, tax, promo, gift card, rounding |
| `lib/services/voucher-service.ts` | `createReceiptVoucherForPayment(tx?)` — supports optional transaction |
| `lib/services/payment-service.ts` | `recordPaymentTransaction(tx?)` — supports optional transaction |
| `lib/services/invoice-service.ts` | `createInvoice(tx?)` — supports optional transaction |

### API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/v1/orders/preview-payment` | POST | Return server-calculated totals (no DB writes) |
| `/api/v1/orders/create-with-payment` | POST | Create order + invoice + payment atomically |

### UI Components

| File | Purpose |
|------|---------|
| `payment-modal-enhanced-02.tsx` | Fetches preview on open; debounced refetch on input change; displays server totals only |
| `amount-mismatch-dialog.tsx` | Shows Field \| Your Value \| Server Value; Refresh Page / Cancel |

### Hook

| Hook | Returns |
|------|---------|
| `useOrderSubmission()` | `submitOrder`, `isSubmitting`, `amountMismatch`, `setAmountMismatch` |

---

## Flow Details

### Preview API

- **Input**: `items`, `customerId`, `isExpress`, `percentDiscount`, `amountDiscount`, `promoCode`, `giftCardNumber`
- **Logic**: Uses `calculateOrderTotals()` → pricing service, tax service, promo validation, gift card validation
- **Output**: `subtotal`, `manualDiscount`, `promoDiscount`, `afterDiscounts`, `vatValue`, `giftCardApplied`, `finalTotal`, `currencyCode`, `decimalPlaces`

### Create-with-Payment API

- **Input**: Full order payload + payment fields + `clientTotals` (from preview)
- **Logic**:
  1. Recalculate totals via `calculateOrderTotals()`
  2. Compare with `clientTotals` (tolerance `0.001`)
  3. If mismatch → return `{ success: false, errorCode: 'AMOUNT_MISMATCH', error, differences }` (400)
  4. If match → `prisma.$transaction`: create order (OrderService), create invoice, create receipt voucher + payment (CASH/CARD/CHECK)
- **Output**: `{ success: true, data: { id, orderId, orderNo, currentStatus } }`

### Amount Mismatch

- User sees server totals in payment modal
- User submits → server recalculates
- If values changed (e.g. pricing updated, stale cache) → mismatch
- API returns 400, no DB writes
- Client opens `AmountMismatchDialog` with `differences` (subtotal, manualDiscount, promoDiscount, vatValue, finalTotal)
- User can **Refresh Page** (reload) or **Cancel** (close, refetch preview, retry)

---

## Tolerance and Rounding

- OMR: 3 decimals, tolerance `0.001`
- All comparisons: `Math.abs(a - b) <= 0.001`
- Rounding: `Number(x.toFixed(decimalPlaces))` using tenant currency decimals

---

## i18n Keys

- `amountMismatch.title`
- `amountMismatch.message`
- `amountMismatch.yourValue`
- `amountMismatch.serverValue`
- `amountMismatch.refreshPage`
- `amountMismatch.cancel`
- `amountMismatch.field`
- `amountMismatch.fields.subtotal`, `.manualDiscount`, `.promoDiscount`, `.vatValue`, `.finalTotal`

---

## Related Documentation

- [NEW_ORDER_PAGE_DOCUMENTATION.md](../features/010_advanced_orders/NEW_ORDER_PAGE_DOCUMENTATION.md) — Full new order page docs
- [finance_invoices_payments_dev_guide.md](./finance_invoices_payments_dev_guide.md) — Invoices and payments overview
