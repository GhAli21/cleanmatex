# Payment Rules & Flow — CleanMateX
**Date:** 2026-05-19

---

## 1. Payment Constants & Enums
**`web-admin/lib/constants/payment.ts`**

| Constant Group | Values |
|---|---|
| **Payment Kinds (5)** | `NORMAL`, `INVOICE`, `DEPOSIT`, `ADVANCE`, `POS` |
| **Payment Methods (10)** | `CASH`, `CARD`, `CHECK`, `INVOICE`, `PAY_ON_COLLECTION`, `BANK_TRANSFER`, `MOBILE_PAYMENT`, `HYPERPAY`, `PAYTABS`, `STRIPE` |
| **Payment Type IDs (4)** | `PAY_IN_ADVANCE`, `PAY_ON_COLLECTION`, `PAY_ON_DELIVERY`, `CREDIT_INVOICE` |
| **Invoice Statuses (7)** | `DRAFT`, `PENDING`, `PARTIAL`, `PAID`, `OVERDUE`, `CANCELLED`, `REFUNDED` |
| **Transaction Statuses (7)** | `PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`, `CANCELLED`, `REFUNDED`, `PARTIALLY_REFUNDED` |
| **Payment Gateways (4)** | `HYPERPAY`, `PAYTABS`, `STRIPE`, `MANUAL` |
| **Payment Nature Types (5)** | `REAL_PAYMENT`, `CREDIT_APPLICATION`, `AR_ALLOCATION`, `DEFERRED_SETTLEMENT`, `INTERNAL_ADJUSTMENT` |
| **Fee Types (3)** | `NONE`, `FIXED`, `PERCENTAGE` |
| **Refund Statuses (5)** | `PENDING`, `APPROVED`, `PROCESSED`, `FAILED`, `CANCELLED` |
| **Order Payment Statuses (5)** | `PENDING`, `COMPLETED`, `FAILED`, `CANCELLED`, `REFUNDED` |

### Method → Settlement Type Mapping (`getPaymentTypeFromMethod`)

| Payment Methods | Maps To |
|---|---|
| `CASH`, `CARD`, `CHECK`, `BANK_TRANSFER`, `MOBILE_PAYMENT`, `HYPERPAY`, `PAYTABS`, `STRIPE` | `PAY_IN_ADVANCE` |
| `PAY_ON_COLLECTION` | `PAY_ON_COLLECTION` |
| `INVOICE` | `CREDIT_INVOICE` |

---

## 2. Order Financial Constants
**`web-admin/lib/constants/order-financial.ts`**

| Constant Group | Values |
|---|---|
| **Order Payment Status (7+)** | `PENDING`, `UNPAID`, `PENDING_COLLECTION`, `PARTIALLY_PAID`, `PAID`, `OVERPAID`, `REFUNDED`, `PARTIALLY_REFUNDED` |
| **Charge Types (4)** | `PREFERENCE`, `EXPRESS`, `BULK_SURCHARGE`, `SPECIAL_HANDLING` |
| **Tax Types (3)** | `VAT`, `GST`, `CUSTOM` |
| **Credit Application Types (5)** | `GIFT_CARD`, `WALLET`, `ADVANCE`, `CREDIT_NOTE`, `LOYALTY_POINTS` |
| **Refund Reason Codes (5)** | `DUPLICATE`, `QUALITY`, `CANCELLED`, `OVERCHARGE`, `OTHER` |
| **Refund Methods (4)** | `ORIGINAL_METHOD`, `CASH`, `CREDIT_NOTE`, `WALLET` |
| **Settlement Type Codes (4)** | `PAY_IN_ADVANCE`, `PAY_ON_COLLECTION`, `PAY_ON_DELIVERY`, `CREDIT_INVOICE` |

---

## 3. Payment Status Lifecycles

### Order Payment Status
```
Order Created
    ↓
PENDING (no payment yet)
    ↓ [partial payment received]
PARTIALLY_PAID
    ↓ [full payment received]
PAID
    ↓ [overpayment]
OVERPAID
    ↓ [refund processed]
PARTIALLY_REFUNDED  or  REFUNDED
```

### Invoice Status
```
DRAFT
    ↓ [issued]
PENDING
    ↓ [partial payment]
PARTIAL
    ↓ [full payment]
PAID
    ↓ [refund]
REFUNDED
    ↓ [reverted]
CANCELLED
```

### Payment Transaction Status
```
PENDING → PROCESSING → COMPLETED
                    ↘ FAILED
                    ↘ CANCELLED
          → REFUNDED (from COMPLETED)
          → PARTIALLY_REFUNDED
```

### Refund Status (3-stage gate)
**`web-admin/lib/services/order-refund.service.ts`**
```
PENDING_APPROVAL → APPROVED → PROCESSED
                ↘ FAILED / CANCELLED
```

---

## 4. Atomic Create-With-Payment Flow
**`web-admin/app/api/v1/orders/create-with-payment/route.ts`**

| Phase | What Happens |
|---|---|
| **1. Validation & Calculation** | Parse request schema, idempotency check (return existing order if key seen), server-side total recalculation (items + discounts + tax + promos + gifts), amount mismatch check vs. client-submitted total (tolerance ±0.001) |
| **2. Payment Leg Resolution** | Single leg from `paymentMethod` + `amountToCharge`, or split-leg array from `paymentLegs`; deferred methods must be sole leg; immediate methods require at least one leg with amount > 0 |
| **3. B2B Credit Check** | Only triggered for invoice-only settlements: credit hold → block (`B2B_CREDIT_HOLD`); credit limit exceeded → block (`B2B_CREDIT_EXCEEDED`) unless admin override with audit trail |
| **4. Order + Promo/Gift Redemption (Tx 1)** | Create order in `org_orders_mst`, redeem promo code (decrement uses), redeem gift card (decrement balance) — entire tx rolled back on any failure |
| **5. Settlement (Tx 2)** | Write all financial fact rows (see §5), update order payment status, emit `PAYMENT_RECEIVED` outbox event |

**Error Codes returned from this endpoint:**
- `AMOUNT_MISMATCH` — client total doesn't match server-calculated total
- `B2B_CREDIT_HOLD` — customer is on credit hold
- `B2B_CREDIT_EXCEEDED` — order would exceed B2B credit limit

---

## 5. Settlement Fact Tables
**`web-admin/lib/services/order-settlement.service.ts`**

| Table | Nature | Purpose |
|---|---|---|
| `org_order_charges_dtl` | — | Service charges (preference, express, bulk, special handling) |
| `org_order_taxes_dtl` | — | VAT/GST/custom tax lines with rates and amounts |
| `org_order_discounts_dtl` | — | All discount types with stacking sequence |
| `org_order_payments_dtl` | `REAL_PAYMENT` | Immediate real payment legs (cash, card, check, etc.) |
| `org_order_credit_apps_dtl` | `CREDIT_APPLICATION` | Gift cards, wallets, advances, loyalty points |
| `org_order_pending_settlements_dtl` | `DEFERRED_SETTLEMENT` | Invoice and pay-on-collection deferred payments |

---

## 6. Enforced Business Rules

### Amount Rules
- Discount **cannot exceed** order subtotal
- Payment amount must be **> 0** for immediate methods
- Refund amount must be **≤ total paid**
- Split payment legs must **sum to order total** (±0.001 tolerance)
- Client-submitted total **must match** server-calculated total (±0.001), else `AMOUNT_MISMATCH` — nothing is created

### Method Rules
- `CHECK` method **requires** a check number
- Deferred methods (`INVOICE`, `PAY_ON_COLLECTION`) **cannot** be combined with immediate methods — must be the sole leg
- Payment method must be **enabled and active** in org config

### B2B Rules
- Credit hold **blocks all new order creation** entirely
- Credit limit enforced **only for invoice-only** (deferred-only) settlements
- Admin can **override credit limit** — override is audit-logged

### Split Payment (Multi-Tender) Rules
- Multiple immediate legs allowed
- Leg amounts must sum exactly to order total (±0.001)
- At most one deferred leg, and it must be alone

---

## 7. Per-Method Configuration Flags
**`web-admin/lib/types/payment.ts` — `OrgPaymentMethodConfig`**

| Flag Category | Flags |
|---|---|
| **Channel restrictions** | `allowed_in_pos`, `allowed_in_admin_app`, `allowed_in_customer_app`, `allowed_in_staff_app` |
| **Use-case restrictions** | `allowed_for_pay_now`, `allowed_for_pay_on_collection`, `allowed_for_invoice_payment`, `allowed_for_refund` |
| **Feature support** | `supports_partial_payment`, `supports_overpayment`, `supports_change_return` |
| **Requirements** | `requires_reference`, `requires_approval`, `requires_cash_drawer`, `requires_terminal` |
| **Limits & fees** | `min_amount`, `max_amount`, `fee_type`, `fee_amount`, `fee_rate`, `currency_code` |

---

## 8. Validation Layers

| Layer | File | Key Rules |
|---|---|---|
| UI Form | `web-admin/src/features/orders/model/payment-form-schema.ts` | Check number required when method=CHECK; discount ≤ subtotal; promo/gift ID required when code provided |
| API Input | `web-admin/lib/validations/new-order-payment-schemas.ts` | Split leg rules; amount mismatch logic; B2B credit; deferred-only leg restriction |
| CRUD Actions | `web-admin/lib/validations/payment-crud-schemas.ts` | Notes max 1000 chars; cancel reason max 500 chars; refund amount positive |

---

## 9. Refund Workflow
**`web-admin/lib/services/order-refund.service.ts`**

**Stage 1 — Initiate (`PENDING_APPROVAL`):**
- Customer or staff initiates refund request
- Captures: amount, reason code (`DUPLICATE`, `QUALITY`, `CANCELLED`, `OVERCHARGE`, `OTHER`), refund method
- Validates: amount ≤ total paid

**Stage 2 — Manager Approval (`APPROVED`):**
- Manager reviews and approves/rejects
- Approval recorded with timestamp

**Stage 3 — Process Refund (`PROCESSED`):**
- `WALLET` → top-up customer wallet balance
- `CREDIT_NOTE` → issue credit note document
- `CASH` / `ORIGINAL_METHOD` → physical reversal (tracked via status only)
- Order payment status updated to `PARTIALLY_REFUNDED` or `REFUNDED`
- Emits `REFUND_PROCESSED` outbox event

---

## 10. B2B Credit Limit Enforcement
**`web-admin/lib/services/credit-limit.service.ts`**

- Non-B2B customers: **not checked** — unlimited
- B2B + `is_credit_hold=true`: **block all new orders**
- B2B + invoice-only order: `currentBalance + orderTotal > creditLimit` → **block** (unless override)
- Available credit = `creditLimit - sum(outstanding invoices)`
- Override: admin can force-create with `creditLimitOverride=true` — logged to audit

---

## 11. Payment Audit Trail
**`web-admin/lib/services/payment-audit.service.ts`**

| Audited Action | Trigger |
|---|---|
| `CREATED` | New payment recorded |
| `CANCELLED` | Payment cancelled with reason |
| `REFUNDED` | Refund initiated |
| `NOTES_UPDATED` | `rec_notes` field changed |

Each entry captures: payment ID, tenant ID, user ID, action timestamp, before/after snapshot of key fields (status, paid_amount, invoice_id, order_id, rec_notes), plus free-form metadata. Append-only for compliance.

---

## 12. Server Actions (RPC Layer)
**`web-admin/app/actions/payments/`**

| Action File | Key Server Actions |
|---|---|
| `payment-crud-actions.ts` | `getPaymentAction`, `updatePaymentNotesAction`, `cancelPaymentAction` (requires `payments:cancel`), `refundPaymentAction` |
| `payment-list-actions.ts` | `getPaymentsAction` — paginated list with filters (status, method, kind, customer, order, date range) |
| `process-payment.ts` | `processPayment` — main processing action, validates schema then calls service layer |
| `invoice-actions.ts` | `createInvoiceAction`, `updateInvoiceAction` |
| `validate-promo.ts` | `validatePromoAction` |
| `validate-gift-card.ts` | `validateGiftCardAction` |

---

## 13. Feature Flags (Payment-Related)
**`web-admin/lib/constants/feature-flags.ts`**

| Flag | Default | Purpose |
|---|---|---|
| `partial_payments_enabled` | false | Allow partial payment on orders |
| `multi_tender_payments` | — | Enable split payment legs |
| `online_payments` | — | Customer-facing online payment |
| `payment_gateway_hyperpay` | false | HyperPay gateway |
| `payment_gateway_paytabs` | false | PayTabs gateway |
| `payment_gateway_stripe` | false | Stripe gateway |
| `advance_payments_enabled` | — | Advance payment kind |
| `emergency_disable_payments` | — | Kill switch for all payments |
| `escrow_enabled` | — | Escrow payment flow |

---

## 14. Key File Reference

| File | Purpose |
|---|---|
| `lib/constants/payment.ts` | Payment kinds, methods, type IDs, statuses, fee types, gateways |
| `lib/constants/order-financial.ts` | Order payment statuses, charge/tax/refund/credit types |
| `lib/types/payment.ts` | TypeScript interfaces: PaymentMethod, Invoice, PaymentTransaction, OrgPaymentMethodConfig |
| `lib/services/payment-service.ts` | Core payment business logic (2649 lines) |
| `lib/services/order-settlement.service.ts` | Atomic settlement — writes all fact tables, emits outbox events |
| `lib/services/order-refund.service.ts` | 3-stage refund workflow |
| `lib/services/credit-limit.service.ts` | B2B credit limit enforcement |
| `lib/services/payment-audit.service.ts` | Append-only audit trail |
| `app/api/v1/orders/create-with-payment/route.ts` | Atomic order+payment API endpoint |
| `lib/validations/payment-crud-schemas.ts` | Zod schemas for payment CRUD operations |
| `lib/validations/new-order-payment-schemas.ts` | Zod schemas for new order payment (split legs, amount mismatch) |
| `src/features/orders/model/payment-form-schema.ts` | Zod schemas for payment UI form |
| `app/actions/payments/` | All payment server actions |
| `src/features/payment-config/` | Admin UI for per-tenant payment method configuration |
