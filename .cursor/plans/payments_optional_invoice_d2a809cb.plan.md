---
name: Payments Optional Invoice
overview: "Implement Option A: make payment optionally independent of invoice (org_payments_dtl_tr + payment_kind); align sys_bill_invoice_payments_tr with currency_code, payment_method_code/payment_type_code FKs, tax/vat, amount DECIMAL(19,4); rename sys_payment_method_cd and sys_payment_type_cd columns; add UI for unapplied payments and apply-to-invoice."
todos: []
isProject: false
---

# Plan: Payments Optional of Invoice (Single Table)

## Goal

Allow payments to exist without an invoice (down payments, POS receipts, advance payments) using the existing `org_payments_dtl_tr` table: make `invoice_id` nullable, add optional `order_id` and `customer_id`, and `payment_kind`. When an invoice is created later, unapplied payments can be "applied" by setting `invoice_id` and updating the invoice. Align `sys_bill_invoice_payments_tr` with standardized columns and FKs; rename columns on `sys_payment_method_cd` and `sys_payment_type_cd`; add UI for unapplied payments and apply-to-invoice.

## Current state

- **org_payments_dtl_tr:** `invoice_id` NOT NULL, FK to `org_invoice_mst`. No `order_id`, `customer_id`, or `payment_kind`.
- **sys_bill_invoice_payments_tr:** has `currency` (default OMR), `payment_method` (free text), `amount`. No `payment_method_code` FK, no `payment_type_code`, no tax/vat columns.
- **sys_payment_method_cd:** columns `payment_type_color1/2/3`, `payment_type_icon`, `payment_type_image`. **sys_payment_type_cd:** PK `payment_type_id`.
- **payment-service.processPayment:** Always gets or creates an invoice; records transaction with `invoice_id`; no non-invoice path.
- **CreatePaymentTransactionInput:** `invoice_id` required. **ProcessPaymentInput:** `order_id` required, no `payment_kind` or `customer_id`.

## 1. Database migration (next seq: 0087)

Create one new migration file: `supabase/migrations/0087_payments_nullable_invoice_and_kind.sql`.

**Execution order:** sys*payment* renames first, then org_payments_dtl_tr, then sys_bill_invoice_payments_tr.

### 1.1 sys_payment_type_cd and sys_payment_method_cd renames

- **sys_payment_type_cd:** `ALTER TABLE sys_payment_type_cd RENAME COLUMN payment_type_id TO payment_type_code;` (PK name change.)
- **sys_payment_method_cd:** RENAME COLUMN: `payment_type_color1` → `payment_method_color1`, `payment_type_color2` → `payment_method_color2`, `payment_type_color3` → `payment_method_color3`, `payment_type_icon` → `payment_method_icon`, `payment_type_image` → `payment_method_image`.

### 1.2 org_payments_dtl_tr (order/tenant payments)

- `ALTER TABLE org_payments_dtl_tr ALTER COLUMN invoice_id DROP NOT NULL;`
- ADD COLUMN `order_id UUID NULL REFERENCES org_orders_mst(id) ON DELETE SET NULL;`
- ADD COLUMN `customer_id UUID NULL REFERENCES org_customers_mst(id) ON DELETE SET NULL;`
- ADD COLUMN `payment_kind VARCHAR(30) NOT NULL DEFAULT 'invoice';` (values: invoice | deposit | advance | pos.)
- ADD CONSTRAINT `chk_org_payment_ref` CHECK (invoice_id IS NOT NULL OR order_id IS NOT NULL OR customer_id IS NOT NULL);
- Indexes: idx_org_payments_order (WHERE order_id IS NOT NULL), idx_org_payments_customer (WHERE customer_id IS NOT NULL), idx_org_payments_kind (tenant_org_id, payment_kind).

### 1.3 sys_bill_invoice_payments_tr (billing invoice payments)

- **currency → currency_code:** RENAME COLUMN; backfill NULLs with 'OMR'; SET NOT NULL; DROP DEFAULT.
- **payment_method → payment_method_code:** RENAME; backfill to valid sys_payment_method_cd codes; ADD FK to sys_payment_method_cd(payment_method_code); SET NOT NULL; no default.
- **Add payment_type_code:** ADD COLUMN payment_type_code VARCHAR(30) NULL REFERENCES sys_payment_type_cd(payment_type_code) ON DELETE SET NULL; (after sys_payment_type_cd rename.)
- **Add Tax and VAT:** e.g. ADD COLUMN tax DECIMAL(19, 4) NULL DEFAULT 0;, vat DECIMAL(19, 4) NULL DEFAULT 0;
- **Alter amount:** ALTER COLUMN amount TYPE DECIMAL(19, 4);

This table uses `payment_method_code` (FK to sys_payment_method_cd), not `payment_kind`.

## 2. Prisma schema (web-admin/prisma/schema.prisma)

- **org_payments_dtl_tr:** invoice_id optional; add order_id, customer_id, payment_kind; optional org_invoice_mst relation; add org_orders_mst?, org_customers_mst? relations; indexes on order_id, customer_id, (tenant_org_id, payment_kind). **org_orders_mst:** add org_payments_dtl_tr[]. **org_customers_mst:** add org_payments_dtl_tr[].
- **sys_payment_method_cd:** payment_method_color1/2/3, payment_method_icon, payment_method_image.
- **sys_payment_type_cd:** payment_type_id → payment_type_code (PK).
- **sys_bill_invoice_payments_tr:** currency_code (NOT NULL); payment_method_code (FK sys_payment_method_cd); payment_type_code? (FK sys_payment_type_cd); tax, vat DECIMAL(19,4); amount DECIMAL(19,4).

Then run `npx prisma generate`.

## 3. Types (web-admin/lib/types/payment.ts)

- **PaymentKind:** 'invoice' | 'deposit' | 'advance' | 'pos'.
- **CreatePaymentTransactionInput:** invoice_id optional; add order_id?, customer_id?, payment_kind? (default 'invoice'). At least one of invoice_id, order_id, customer_id required.
- **PaymentTransaction:** invoice_id?, order_id?, customer_id?, payment_kind.
- **ProcessPaymentInput:** order_id optional; add customer_id?, payment_kind?.

## 4. Payment service (web-admin/lib/services/payment-service.ts)

- **recordPaymentTransaction:** Accept optional invoice_id; order_id, customer_id, payment_kind. Build data with at least one of invoice_id/order_id/customer_id. Handle null invoice_id in create.
- **processPayment:** Branch 1 (invoice): existing logic when invoice_id or order_id with invoice intent. Branch 2 (non-invoice): when payment_kind deposit/advance/pos, require order_id and/or customer_id; record without invoice; optionally update order paid_amount. **refundPayment:** Copy invoice_id, order_id, customer_id from original (all nullable); only update invoice when transaction.invoice_id is not null.
- **getPaymentHistory(invoiceId):** unchanged.
- **New:** getPaymentsForOrder(orderId), getPaymentsForCustomer(customerId), applyPaymentToInvoice(paymentId, invoiceId) — load payment (no invoice_id), update payment with invoice_id, update invoice paid_amount and order if applicable.

## 5. Server actions

- **process-payment:** ProcessPaymentActionInput: add customerId?, paymentKind?. Pass through to service; support non-invoice path when paymentKind deposit/advance/pos and no invoiceId.
- **Add applyPaymentToInvoice action** (new or in existing payments actions file) calling service applyPaymentToInvoice.

## 6. UI enhancements

- **Invoice detail:** Keep getPaymentHistory; optionally show payment_kind badge.
- **Order detail:** "Unapplied payments" section via getPaymentsForOrder (filter invoice_id null); "Apply to invoice" button/flow calling applyPaymentToInvoice.
- **Customer detail:** "Advance balance" / unapplied payments via getPaymentsForCustomer.
- **Record payment form:** Support payment kind (invoice | deposit | advance | pos); when deposit/pos require order; when advance require customer; call processPayment without invoiceId when non-invoice.
- **i18n:** Add keys (e.g. unappliedPayments, applyToInvoice, paymentKind, deposit, advance, pos) in en.json and ar.json. RTL/a11y preserved.

## 7. Code and docs

- **Code refs:** Any use of payment*type_id, payment_type_color1/icon/image on sys_payment* (e.g. payment-service getAvailablePaymentMethods, seed 0030) must use new column names (payment_type_code, payment_method_color1, payment_method_icon, etc.).
- **Docs:** Update docs/dev/finance_invoices_payments_dev_guide.md with payment kinds, nullable invoice_id, apply-to-invoice flow, new service functions.

## Order of implementation

1. Migration 0087 (sys*payment* renames, org_payments_dtl_tr, sys_bill_invoice_payments_tr); apply locally.
2. Prisma schema updates; prisma generate.
3. Types (PaymentKind, CreatePaymentTransactionInput, PaymentTransaction, ProcessPaymentInput).
4. Payment service (recordPaymentTransaction, processPayment branches, refundPayment, getPaymentsForOrder, getPaymentsForCustomer, applyPaymentToInvoice).
5. Server actions (process-payment pass-through, applyPaymentToInvoice action).
6. UI (order/customer/record-payment/invoice detail); i18n.
7. Code refs (payment_method_icon etc.); dev guide.

## Files to touch

- **Migration:** supabase/migrations/0087_payments_nullable_invoice_and_kind.sql (new)
- **Prisma:** org_payments_dtl_tr, org_orders_mst, org_customers_mst, sys_payment_method_cd, sys_payment_type_cd, sys_bill_invoice_payments_tr
- **Types:** web-admin/lib/types/payment.ts
- **Service:** web-admin/lib/services/payment-service.ts
- **Actions:** process-payment.ts; add applyPaymentToInvoice
- **UI:** Order detail, customer detail, record-payment form, invoice detail (optional badge)
- **i18n:** web-admin/messages/en.json, ar.json
- **Code:** getAvailablePaymentMethods, seed 0030 (column names)
- **Docs:** docs/dev/finance_invoices_payments_dev_guide.md
