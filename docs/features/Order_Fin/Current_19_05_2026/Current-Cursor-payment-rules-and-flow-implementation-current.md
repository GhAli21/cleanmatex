# Payment Rules & Flow â€” Implementation Current State

**Document type:** Agent exploration summary (conversation-derived)  
**Date:** 2026-05-19  
**Scope:** CleanMateX tenant `web-admin` â€” new order checkout + post-order payments  
**Related:** See also `payment-rules-and-flow.md` in this folder for constants/enums reference tables.

---

## Table of Contents

1. [Overview â€” Two Main Payment Paths](#1-overview--two-main-payment-paths)
2. [Payment Methods, Types & Statuses](#2-payment-methods-types--statuses)
3. [Server-Side Calculation Rules](#3-server-side-calculation-rules)
4. [New Order Checkout Flow](#4-new-order-checkout-flow)
5. [Post-Order Payment Flow](#5-post-order-payment-flow)
6. [Promo & Gift Card Rules](#6-promo--gift-card-rules)
7. [Cancel, Refund & Audit](#7-cancel-refund--audit)
8. [Permissions](#8-permissions)
9. [UI Surfaces](#9-ui-surfaces)
10. [Not Yet Implemented](#10-not-yet-implemented)
11. [Key Source Files](#11-key-source-files)

---

## 1. Overview â€” Two Main Payment Paths

| Path | When used | Entry points |
|------|-----------|--------------|
| **A. New order checkout** | POS / New Order | `POST /api/v1/orders/preview-payment` â†’ `POST /api/v1/orders/create-with-payment` |
| **B. Post-order payments** | Invoice detail, order detail, customer advance | `processPayment()` service + server actions |

**Critical rule (checkout):** Order + invoice + settlement must succeed together. On amount mismatch, **nothing is persisted**.

**Critical rule (post-order):** Uses `processPayment` (server action â†’ `payment-service.ts`). No `clientTotals` check, no `settleOrder` â€” direct `recordPaymentTransaction` + receipt voucher + ERP-Lite auto-post.

---

## 2. Payment Methods, Types & Statuses

**Source:** `web-admin/lib/constants/payment.ts`

### Payment methods

- **Immediate:** `CASH`, `CARD`, `CHECK`, `BANK_TRANSFER`, `MOBILE_PAYMENT`, gateways `HYPERPAY`, `PAYTABS`, `STRIPE`
- **Deferred:** `PAY_ON_COLLECTION`, `INVOICE`

### Payment kinds (`org_payments_dtl_tr.payment_kind`)

- `invoice` (default), `deposit`, `advance`, `pos`

### Payment type mapping (method â†’ `sys_payment_type_cd`)

| Methods | Type |
|---------|------|
| Cash, Card, Check, Bank, Mobile, Gateways | `PAY_IN_ADVANCE` |
| Pay on Collection | `PAY_ON_COLLECTION` |
| Invoice | `CREDIT_INVOICE` |

### Statuses

- **Transaction:** `pending`, `processing`, `completed`, `failed`, `cancelled`, `refunded`, `partially_refunded`
- **Invoice:** `draft`, `pending`, `partial`, `paid`, `overdue`, `cancelled`, `refunded`

### Domain constraints

- `GIFT_CARD` is a **credit application**, not a settlement method
- `PROMO_CODE` is a **discount source**, not a settlement method

---

## 3. Server-Side Calculation Rules

All checkout totals are computed on the server via `calculateOrderTotals()` (`order-calculation.service.ts`).

| Rule | Behavior |
|------|----------|
| **Pricing** | Per-item price from pricing service + optional service/packing surcharges |
| **Manual discount** | **Percent OR amount** â€” if percent > 0, amount is ignored; capped at subtotal |
| **Auto discount rules** | Best single rule from `org_discount_rules_cf`; applied after manual discount |
| **Promo vs auto rule** | If rule cannot stack with promo â†’ **larger discount wins** (one suppressed) |
| **Stackable promo** | Auto rule + promo both apply when `can_stack_with_promo` |
| **VAT** | Tenant/branch tax rate on `afterDiscounts` |
| **Additional tax** | Optional rate or fixed amount on `afterDiscounts` |
| **Gift card** | Applied after tax; capped at balance and amount before gift card |
| **Rounding** | Tenant currency decimals (e.g. OMR = 3); tolerance **0.001** on comparisons |
| **Preview vs submit** | Client sends `clientTotals`; server recalculates; mismatch â†’ `AMOUNT_MISMATCH` (400) |

---

## 4. New Order Checkout Flow

**Route:** `/dashboard/orders/new`  
**UI:** `PaymentModalV3` (loaded as `PaymentModalEnhanced02` in `new-order-modals.tsx`)  
**Submit:** `useOrderSubmission` â†’ `POST /api/v1/orders/create-with-payment`

### End-to-end flow

```
Build cart â†’ Submit opens payment modal
  â†’ POST /api/v1/orders/preview-payment (debounced 300ms)
  â†’ User picks method, discounts, optional partial/split pay
  â†’ POST /api/v1/orders/create-with-payment
  â†’ Server recalculates; compares clientTotals (Â±0.001)
  â†’ Tx1: order + invoice + promo usage + gift debit
  â†’ Tx2: settleOrder() â€” payment legs, vouchers, financial facts
  â†’ Invoice status updated (partial / paid) when money collected now
```

**Edit mode:** Same modal, but submit uses `PATCH /api/v1/orders/{id}/update` â€” **not** create-with-payment.

### Create-with-payment rules

| Rule | Detail |
|------|--------|
| **Auth** | CSRF + `orders:create` permission |
| **Idempotency** | Optional `idempotencyKey` â€” retries return existing order |
| **Amount to charge** | Sum of non-deferred legs; must be `0 â€¦ finalTotal` |
| **Immediate payment** | If any immediate leg exists, `amountToCharge > 0` required |
| **Partial pay** | Allowed for CASH/CARD/CHECK; invoice/order â†’ `partial` if paid < total, else `paid` |
| **Multi-leg split** | Leg amounts must sum to `finalTotal` (Â±0.001) |
| **Deferred legs** | `INVOICE` / `PAY_ON_COLLECTION` **cannot** be mixed with other legs |
| **Check** | Each `CHECK` leg requires `checkNumber` |
| **B2B credit** | All-deferred checkout runs `checkCreditLimit()` â€” blocks on hold; blocks on exceed unless `creditLimitOverride` |
| **Promo** | Applied in Tx1 with `SELECT FOR UPDATE` (race-safe `max_uses`) |
| **Gift card** | Debited in Tx1 with `SELECT FOR UPDATE` |
| **Settlement** | Tx2: `settleOrder()` writes financial fact tables from `org_payment_methods_cf` |
| **Invoice status** | Updated after settlement when immediate payment > 0 |

### Retail vs service orders

| Rule | Services | Retail-only (`RETAIL_ITEMS`) |
|------|----------|------------------------------|
| Mix with other categories | âŒ Blocked at add-item | â€” |
| Pay on Collection | âœ… Available | âŒ Hidden + rejected on submit |
| Default method | Pay on Collection | Cash |
| Order status after create | Normal workflow | **`closed`** (POS handover) |
| Stock | â€” | Deducted after create; insufficient stock **rolls back** |

### Partial payment (new order)

- Only for **immediate** methods (Cash/Card/Check/Bank/Mobile)
- User toggles â€œPay partialâ€ and enters amount now (0 â€¦ final total)
- `amountToCharge` sent to API
- Remaining balance collected later via invoice/order payment screens

### Split payment (multi-leg)

- Multiple immediate legs (e.g. Cash + Card)
- Each leg amount > 0; **sum = `finalTotal`** (Â±0.001)
- Sent as `paymentLegs[]` to create-with-payment
- Cannot combine with deferred methods in the same checkout

### Promo & gift on new order

- Controlled by `NEW_ORDER_PROMO_GIFT_DISABLED` in `order-checkout-flags.ts` â€” currently **`false`** (enabled)
- Promo: validated in modal â†’ preview includes code â†’ usage recorded in **Tx1**
- Gift: validate (+ PIN if needed) â†’ preview â†’ debit in **Tx1**

### B2B / Invoice checkout (new order)

| Check | Error code |
|-------|------------|
| Customer on credit hold | `B2B_CREDIT_HOLD` |
| Order exceeds available credit | `B2B_CREDIT_EXCEEDED` |
| Admin override (warn mode) | `creditLimitOverride: true` on payload |

### Client-side validation (new order, before API)

- Customer required, items required, valid product UUIDs
- Retail + Pay on Collection blocked
- Check â†’ check number required
- Partial/split amounts valid
- `newOrderPaymentPayloadSchema` (amount â‰¤ total, etc.)

### Server validation (create-with-payment)

| Rule | Result |
|------|--------|
| CSRF + `orders:create` | 403 if missing |
| Zod body validation | 400 + details |
| `clientTotals` vs server | `AMOUNT_MISMATCH` |
| `amountToCharge` in range | 400 |
| Immediate pay requires amount > 0 | 400 |
| Multi-leg sum = total | `SPLIT_AMOUNT_MISMATCH` |
| Deferred leg not alone with others | `DEFERRED_LEG_NOT_ALONE` |
| CHECK leg without number | `CHECK_NUMBER_REQUIRED` |
| B2B credit rules | `B2B_CREDIT_*` |
| Idempotency key retry | Returns existing order (no duplicate) |

### Error handling (new order UI)

| Error | UX |
|-------|-----|
| `AMOUNT_MISMATCH` | `AmountMismatchDialog` â€” refresh or cancel and retry |
| Other 400/403/500 | Toast with formatted message |
| Success | Toast + optional navigate to order/preparation |

Idempotency: one `idempotencyKey` per submit session (stable across retries until success).

### What new order does *not* do

- Real-time card/gateway charging (HyperPay/PayTabs/Stripe)
- Pay-on-collection for retail
- Mix retail + service items in one order
- Sequential create â†’ invoice â†’ pay (replaced by atomic create-with-payment)

---

## 5. Post-Order Payment Flow

**Entry point:** `processPayment` in `app/actions/payments/process-payment.ts`  
**Service:** `web-admin/lib/services/payment-service.ts`

### Where payments happen

| Surface | Route | Purpose |
|---------|-------|---------|
| Invoice detail | `/dashboard/internal_fin/invoices/[id]` | Pay down **remaining invoice balance** |
| Order detail | `/dashboard/orders/[id]` | **Deposit/POS** (no invoice); **apply** unapplied $ to invoice |
| Customer detail | `/dashboard/customers/[id]` | **Advance** payments (customer balance) |
| Payments list | `/dashboard/internal_fin/payments` | View all; **cancel** / **refund** |
| Payment detail | `/dashboard/internal_fin/payments/[id]` | View one; cancel / refund; print receipt |
| New payment | `/dashboard/internal_fin/payments/new` | Manual entry for any **payment kind** |

### Payment kinds â€” post-order

| Kind | Requires | `invoice_id` | Typical use |
|------|----------|--------------|-------------|
| **`invoice`** | `order_id` and/or `invoice_id` | Set when paying invoice | Invoice detail, paying balance |
| **`deposit`** | `order_id` | **null** until applied | Down payment before/at service |
| **`pos`** | `order_id` | **null** until applied | POS receipt not tied to invoice yet |
| **`advance`** | `customer_id` | **null** until applied | Customer prepayment / credit |

**Constraint:** At least one of `invoice_id`, `order_id`, or `customer_id` must be set on every row.

### Core service flow (`processPayment`)

#### Path A â€” Non-invoice (`deposit` | `advance` | `pos`, no `invoice_id`)

| Rule | Detail |
|------|--------|
| `advance` | Requires `customer_id` |
| `deposit` / `pos` | Requires `order_id` |
| Invoice | **Not** created or updated |
| Order | If `order_id` â†’ increases `paid_amount`; `partial` or `paid` vs order total |
| Voucher | Receipt voucher created via `recordPaymentTransaction` |

#### Path B â€” Invoice-linked (default)

| Step | Behavior |
|------|----------|
| 1 | `validatePaymentData` |
| 2 | `processPaymentByMethod` (gateway stub for CARD) |
| 3 | If no `invoice_id` but has `order_id` â†’ **`createInvoiceForOrder`** |
| 4 | `recordPaymentTransaction` with `paid_amount = input.amount` (user amount, not `final_total`) |
| 5 | **Receipt voucher** (`createReceiptVoucherForPayment`) â€” **no payment without voucher** |
| 6 | **ERP-Lite blocking auto-post** (failure rolls back transaction) |
| 7 | Invoice `paid_amount` += payment; status â†’ `partial` or `paid` |
| 8 | Order `paid_amount` / `payment_status` updated if linked |

**Partial payments:** Multiple rows per invoice allowed; `paid_amount` on invoice = sum of completed payments; balance = `total - paid_amount`.

#### Path C â€” FIFO across invoices (`distributeAcrossInvoices: true`)

| Rule | Detail |
|------|--------|
| When | No `invoice_id`, has `order_id`, amount > 0 |
| Order | Oldest invoice with balance first |
| Cap | Total payment â‰¤ sum of remaining balances (`AMOUNT_EXCEEDS_BALANCE`) |
| Result | Multiple payment rows; invoice + order updated per slice |

### Validation rules (`validatePaymentData`)

| Check | Error code |
|-------|------------|
| Tenant session | `UNAUTHORIZED` |
| Amount > 0 | `INVALID_AMOUNT` |
| Method enabled in `sys_payment_method_cd` | `INVALID_METHOD` |
| CHECK â†’ `check_number` required | `CHECK_NUMBER_REQUIRED` |
| Advance â†’ customer exists | `CUSTOMER_REQUIRED` / `CUSTOMER_NOT_FOUND` |
| Deposit/POS â†’ order exists | `ORDER_REQUIRED` / `ORDER_NOT_FOUND` |
| Invoice payment â†’ order or invoice | `ORDER_OR_INVOICE_REQUIRED` |
| Amount â‰¤ invoice remaining (when `invoice_id` set) | `AMOUNT_EXCEEDS_BALANCE` |
| FIFO: total payment â‰¤ sum of invoice remainings | `AMOUNT_EXCEEDS_BALANCE` |

### Screen-by-screen â€” post-order

#### Invoice detail â€” Record payment

**File:** `record-payment-client.tsx` on `/dashboard/internal_fin/invoices/[id]`

| Rule | Behavior |
|------|----------|
| Default amount | Remaining balance (`total - paid_amount`) |
| Max amount | Cannot exceed remaining balance (client + server) |
| Methods in UI | **Cash** and **Card** only |
| `payment_kind` | `invoice` |
| Calls | `processPayment` with `invoiceId`, `orderId`, breakdown fields |
| After success | `router.refresh()` |

Form is always shown; submit fails if amount invalid.

#### Order detail â€” Deposit / POS + Apply

**File:** `order-detail-client.tsx`

**Record deposit / POS**

| Field | Options |
|-------|---------|
| Kind | `deposit` or `pos` |
| Method | Cash or Card |
| Amount | > 0 |
| Invoice | **Not** sent â€” payment stored with `invoice_id = null` |

**Unapplied payments**

- Lists payments for order where `invoice_id` is null
- **Apply to invoice** â†’ `applyPaymentToInvoice(paymentId, invoiceId)`
  - Links payment to invoice
  - Increases invoice `paid_amount` / status
  - Updates order `paid_amount` if `order_id` present
  - **Cannot** apply if already linked to an invoice

#### Customer detail â€” Advance

**File:** `customers/[id]/page.tsx`

| Rule | Behavior |
|------|----------|
| `payment_kind` | `advance` |
| `customer_id` | Required |
| No order/invoice | On create |
| Balance UI | Sum of unapplied advance rows (`invoice_id` null) |
| Methods | Cash / Card |

#### Billing â†’ New payment (standalone)

**File:** `/dashboard/internal_fin/payments/new` â†’ `create-payment-form.tsx`

| Kind | Required fields |
|------|-----------------|
| `invoice` | `invoice_id` (optional `order_id`, `customer_id`) |
| `deposit` / `pos` | `order_id` |
| `advance` | `customer_id` |

Uses `createStandalonePaymentAction` â†’ same `processPayment` service.

#### Payments list & detail â€” Cancel / Refund

| Action | Permission | Rules |
|--------|------------|-------|
| **Cancel** | `payments:cancel` | Reason required (1â€“500 chars); reverses invoice/order balances; audit row; cannot cancel if already cancelled/refunded or if refunds exist |
| **Refund** | `payments:refund` | Only **`completed`** payments; amount > 0; amount â‰¤ remaining refundable; **refund voucher first** (`REF-*`); new row with **negative** `paid_amount`, status `refunded`; reverses invoice/order |

**Partial refunds:** Multiple refund rows allowed until original amount fully refunded (tracked via `metadata.original_transaction_id`).

**Original payment row:** Stays `completed` (refunds are separate rows).

### Voucher rule (mandatory)

Every completed payment row must have `voucher_id` â†’ `org_fin_vouchers_mst`:

| Type | Prefix | When |
|------|--------|------|
| Receipt | `RCP-YYYY-NNNNN` | Before payment insert (`createReceiptVoucherForPayment`) |
| Refund | `REF-YYYY-NNNNN` | Before refund row (`createRefundVoucherForPayment`) |

Print: `/dashboard/internal_fin/payments/[id]/print/receipt-voucher`

### Gateway / method behavior (post-order)

| Method | Status after record |
|--------|---------------------|
| CASH, CHECK, PAY_ON_COLLECTION, INVOICE | `completed` |
| CARD, HYPERPAY, PAYTABS, STRIPE | `pending` + `requires_gateway_processing` (no real gateway yet) |

### Workflow integration (order lifecycle)

| Event | Payment behavior |
|-------|------------------|
| **Order cancel** (before delivery) | `order-cancel-service` â†’ cancels linked payments via `cancelPayment` |
| **Customer return** (after delivery) | `workflow-service-enhanced` â†’ `refundPayment` per completed payment |

### New order vs post-order comparison

| New order (`create-with-payment`) | Post-order (`processPayment`) |
|-----------------------------------|-------------------------------|
| Server recalc + `AMOUNT_MISMATCH` | No client/server total compare |
| `settleOrder()` + financial fact tables | Direct `recordPaymentTransaction` |
| Multi-leg split in one checkout | One amount per call (FIFO = multiple txns) |
| Promo/gift at checkout (atomic) | Promo/gift **not** auto-debited in standalone `processPayment` |
| B2B credit limit on deferred checkout | Not in standalone invoice pay |

### Typical post-order scenarios

**Collect rest of invoice after partial new-order pay**  
Invoice detail â†’ enter amount (â‰¤ balance) â†’ Cash/Card â†’ `processPayment` â†’ invoice `partial`/`paid`.

**Take deposit before work**  
Order detail â†’ Record deposit â†’ later **Apply to invoice** when invoice exists.

**B2B customer prepayment**  
Customer detail â†’ Record advance â†’ apply to invoice from order when ready.

**Mistake on today's cash payment**  
Payments list â†’ Cancel (with reason) â†’ balances reversed.

**Return after paid**  
Workflow return â†’ `refundPayment` â†’ refund voucher + negative payment row.

---

## 6. Promo & Gift Card Rules

### Promo code (`validatePromoCode` â€” `discount-service.ts`)

- Must exist, `is_active` + `is_enabled`
- Within `valid_from` / `valid_to`
- Global `max_uses` not exceeded
- `min_order_amount` / `max_order_amount` met
- Per-customer `max_uses_per_customer` enforced
- Usage recorded atomically on checkout (`applyPromoCodeTx`)

### Gift card (`validateGiftCard` â€” `gift-card-service.ts`)

- Active card; not `VOIDED`, `SUSPENDED`, or expired
- Balance applied up to order total (after tax)
- Redemption atomic on checkout (`redeemGiftCardTx`)
- PIN/auth path supported via ID-based validation after pre-auth

---

## 7. Cancel, Refund & Audit

| Action | Permission | Rules |
|--------|------------|-------|
| **Cancel** | `payments:cancel` | Reverses invoice/order balances; audit logged; cannot cancel if refunded |
| **Refund** | `payments:refund` | Refund voucher first; amount > 0 and â‰¤ original; original must be `completed`; partial refunds allowed |

Workflow: order cancel can cancel linked payments; customer return triggers refunds via `refundPayment`.

---

## 8. Permissions

| Code | Purpose |
|------|---------|
| `orders:create` | New order checkout API |
| `payments:create` | Record payments |
| `payments:read` | View payments |
| `payments:cancel` | Cancel payment |
| `payments:refund` | Process refund |
| `payments:configure` | Payment config (methods, terminals, drawers) |
| `payments:view_methods` | View configured methods |

---

## 9. UI Surfaces

| Screen | Flow |
|--------|------|
| **New Order** â€” `payment-modal-v3.tsx` | Preview totals; full/partial pay; multi-leg; retail/B2B rules |
| **Billing â†’ Invoice detail** | Record additional payment against remaining balance |
| **Order detail** | Deposit/POS; apply unapplied payments to invoice |
| **Customer detail** | Record advance; view unapplied balance |
| **Billing â†’ Payments list** | List, cancel, refund |
| **Settings â†’ Payments** | Tenant payment method/terminal/cash drawer config (V1 HQ-linked) |

---

## 10. Not Yet Implemented

- **Payment gateway capture** for CARD/HyperPay/PayTabs/Stripe (marked pending; no real gateway call)
- **Customer app / wallet payments** (separate PRD â€” not in tenant web-admin flow)
- Some **ERP-Lite batch posting** edge cases when FIFO pays multiple invoices (noted in code comments)
- Promo/gift UI on checkout may be disabled via `NEW_ORDER_PROMO_GIFT_DISABLED` flag (backend support remains)

---

## 11. Key Source Files

### New order

| Area | Path |
|------|------|
| Payment UI | `web-admin/src/features/orders/ui/payment-modal-v3.tsx` |
| Submit hook | `web-admin/src/features/orders/hooks/use-order-submission.ts` |
| Modal host | `web-admin/src/features/orders/ui/new-order-modals.tsx` |
| Preview API | `web-admin/app/api/v1/orders/preview-payment/route.ts` |
| Create API | `web-admin/app/api/v1/orders/create-with-payment/route.ts` |
| Calculation | `web-admin/lib/services/order-calculation.service.ts` |
| Settlement | `web-admin/lib/services/order-settlement.service.ts` |
| Schemas | `web-admin/lib/validations/new-order-payment-schemas.ts` |

### Post-order

| Area | Path |
|------|------|
| Server action | `web-admin/app/actions/payments/process-payment.ts` |
| CRUD actions | `web-admin/app/actions/payments/payment-crud-actions.ts` |
| Service | `web-admin/lib/services/payment-service.ts` |
| Invoice UI | `web-admin/app/dashboard/internal_fin/invoices/[id]/record-payment-client.tsx` |
| Order UI | `web-admin/app/dashboard/orders/[id]/order-detail-client.tsx` |
| Customer UI | `web-admin/app/dashboard/customers/[id]/page.tsx` |
| Schemas | `web-admin/lib/validations/payment-crud-schemas.ts` |

### Shared / docs

| Area | Path |
|------|------|
| Constants | `web-admin/lib/constants/payment.ts` |
| Finance guide | `docs/dev/finance_invoices_payments_dev_guide.md` |
| Server calc doc | `docs/dev/server_side_payment_calculation.md` |
| Cancel/refund plan | `docs/dev/payment_cancel_refund_and_audit_plan.md` |

---

*Generated from agent session exploration of the codebase on 2026-05-19. Verify against live code before treating as authoritative for migrations or contract changes.*
