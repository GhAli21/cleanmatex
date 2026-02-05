# Unification Audit: order-types.ts vs payment.ts

## Already unified (single source: `lib/constants/payment.ts`)

| Item | Source | Re-exported from |
|------|--------|------------------|
| PAYMENT_KINDS | constants/payment.ts | order-types.ts |
| PAYMENT_METHODS | constants/payment.ts | order-types.ts |
| PaymentMethodCode | constants/payment.ts | order-types.ts, types/payment.ts |
| PaymentKind | constants/payment.ts | order-types.ts, types/payment.ts |
| getPaymentTypeFromMethod | constants/payment.ts | order-types.ts |

---

## Further unification candidates (payment domain)

### 1. PaymentTypeId (recommended)

- **Current:** Type-only union in `lib/types/payment.ts`: `'PAY_IN_ADVANCE' | 'PAY_ON_COLLECTION' | 'PAY_ON_DELIVERY' | 'CREDIT_INVOICE'`.
- **Action:** Add `PAYMENT_TYPE_IDS` const + derived type in `lib/constants/payment.ts`. Use it for `getPaymentTypeFromMethod()` return type. Re-export type from `lib/types/payment.ts`.

### 2. InvoiceStatus (recommended)

- **Current:** Type-only union in `lib/types/payment.ts`: draft, pending, partial, paid, overdue, cancelled, refunded.
- **Action:** Add `INVOICE_STATUSES` const + derived type in `lib/constants/payment.ts`. Re-export from `lib/types/payment.ts`.

### 3. PaymentStatus – transaction lifecycle (optional)

- **Current:** Type-only in `lib/types/payment.ts`: pending, processing, completed, failed, cancelled, refunded, partially_refunded.
- **Action:** Add `PAYMENT_STATUSES` (transaction) const in `lib/constants/payment.ts`; re-export type from `lib/types/payment.ts`.
- **Note:** Distinct from order-level `payment_status` in `types/order.ts` (pending, partial, paid, refunded, failed). Consider naming: `TransactionPaymentStatus` vs `OrderPaymentStatus` if both are exported from payment types.

### 4. PaymentGateway (optional)

- **Current:** Type-only in `lib/types/payment.ts`: 'hyperpay' | 'paytabs' | 'stripe' | 'manual' | null.
- **Action:** Add `PAYMENT_GATEWAYS` const (or similar) in `lib/constants/payment.ts`; re-export type from `lib/types/payment.ts`.

---

## Order status – not between order-types and payment

### OrderStatus / ORDER_STATUSES

- **order-types.ts:** Defines `ORDER_STATUSES` (draft, **pending**, **preparing**, intake, processing, ready, delivered, **completed**, cancelled) and `OrderStatus`. **Not imported anywhere** in the codebase.
- **lib/types/workflow.ts:** Defines `OrderStatus` and `ORDER_STATUSES` (draft, intake, **preparation**, processing, **sorting**, washing, drying, finishing, assembly, qa, packing, ready, out_for_delivery, delivered, **closed**, cancelled). **This is the one used everywhere** (workflow-service, API routes, UI).
- **lib/validations/workflow-schema.ts:** `OrderStatusEnum` (zod) matches workflow.ts.
- **types/order.ts:** Duplicate `OrderStatus` type (same values as workflow.ts).

**Recommendation:**

- Treat **lib/types/workflow.ts** as the single source of truth for order workflow status.
- Either **remove** `ORDER_STATUSES` and `OrderStatus` from `lib/constants/order-types.ts` (they are unused), or keep them only if a separate “simplified” status set is required and document that workflow.ts is the canonical source for workflow OrderStatus.
- Prefer importing `OrderStatus` from `@/lib/types/workflow`; align `types/order.ts` to re-export from workflow or remove its duplicate type.

---

## Summary

| Category | Action |
|----------|--------|
| Payment methods/kinds | Done – single source in `lib/constants/payment.ts`. |
| PaymentTypeId | Done – `PAYMENT_TYPE_IDS` + type in `lib/constants/payment.ts`; re-exported from `lib/types/payment.ts`. |
| InvoiceStatus | Done – `INVOICE_STATUSES` + type in `lib/constants/payment.ts`; re-exported from `lib/types/payment.ts`. |
| PaymentStatus (transaction) | Done – `PAYMENT_STATUSES` + type in `lib/constants/payment.ts`; re-exported from `lib/types/payment.ts`. |
| PaymentGateway | Done – `PAYMENT_GATEWAYS` + type in `lib/constants/payment.ts`; re-exported from `lib/types/payment.ts`. |
| OrderStatus | `lib/types/workflow.ts` is source of truth. `order-types.ts` ORDER_STATUSES documented as simplified set; not imported elsewhere. |
