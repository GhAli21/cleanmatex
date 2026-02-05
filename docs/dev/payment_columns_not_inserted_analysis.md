# Payment-Related Columns Not Inserted/Updated During Payment Transaction

Analysis using Supabase MCP (local) schema and `payment-service.ts` code.  
Tables: `org_payments_dtl_tr`, `org_invoice_mst`, `org_orders_mst`.

---

## 1. org_payments_dtl_tr (payment transaction insert)

**Source:** `recordPaymentTransaction()` → `prisma.org_payments_dtl_tr.create({ data: { ... } })`.

### Columns that ARE inserted
- `tenant_org_id`, `invoice_id`, `order_id`, `customer_id`
- `currency_code`, `currency_ex_rate`, `paid_amount`, `payment_method_code`, `payment_type_code`
- `tax_amount`, `vat_amount`, `paid_at`, `paid_by`, `status`, `gateway`, `transaction_id`
- `metadata`, `rec_notes`, `trans_desc`
- `created_at`, `created_by`

### Payment-related columns in DB but NOT inserted (always null/omitted)

| Column | Type | Notes |
|--------|------|--------|
| **due_date** | date | Not set on insert |
| **subtotal** | numeric | Input has it; only stored in `metadata.calculation_breakdown` |
| **discount_rate** | numeric | Input has it; only in metadata |
| **discount_amount** | numeric | Input has it; only in metadata |
| **vat_rate** | numeric | Input has it; only in metadata |
| **manual_discount_amount** | numeric | Input has it; only in metadata |
| **promo_discount_amount** | numeric | Input has it; only in metadata |
| **gift_card_applied_amount** | numeric | Input has it; only in metadata |
| **promo_code_id** | uuid | Input has it; not in create data |
| **gift_card_id** | uuid | Input has it; not in create data |
| **check_number** | varchar | Input has it; **not in create data** (gap) |
| **check_bank** | varchar | Input has it; **not in create data** (gap) |
| **check_date** | date | Input has it; **not in create data** (gap) |
| **payment_channel** | varchar | Has DB default `'web_admin'`; not set explicitly |
| **created_info** | text | Audit; not set |
| **updated_at** | timestamp | Not set on insert |
| **updated_by** | varchar | Not set on insert |
| **updated_info** | text | Not set on insert |

**Recommendation:** Add `check_number`, `check_bank`, `check_date` to the `create` data in `recordPaymentTransaction` so CHECK payments are stored at row level. Optionally add `subtotal`, `discount_rate`, `discount_amount`, `vat_rate`, `manual_discount_amount`, `promo_discount_amount`, `gift_card_applied_amount`, `promo_code_id`, `gift_card_id`, and `payment_channel` if you want them as first-class columns instead of only in metadata.

---

## 2. org_invoice_mst (updated when payment is recorded)

**Source:** `processPayment()` after `recordPaymentTransaction()` → `prisma.org_invoice_mst.update()`.

### Payment-related columns that ARE updated
- `paid_amount`, `status`, `paid_at`, `paid_by`, `payment_method_code`
- `updated_at`, `updated_by`

### Payment-related columns in DB but NOT updated on payment

| Column | Type | Notes |
|--------|------|--------|
| due_date | date | Set at invoice creation |
| currency_code | varchar | Set at creation |
| currency_ex_rate | numeric | Set at creation |
| vat_rate | numeric | Set at creation |
| vat_amount | numeric | Set at creation |
| discount_rate | numeric | Set at creation |
| discount_type | varchar | Set at creation |
| promo_code_id | uuid | Set at creation |
| promo_discount_amount | numeric | Set at creation |
| metadata | jsonb | Not updated on payment |

**Conclusion:** Invoice update on payment intentionally only updates paid amount, status, timestamps, and payment method. Other payment-related columns are invoice-level and set at creation; no change needed unless you want to sync e.g. currency or VAT from the payment.

---

## 3. org_orders_mst (updated when payment is recorded)

**Source:** `updateOrderPaymentStatus()` → `prisma.org_orders_mst.update()`.

### Payment-related columns that ARE updated
- `payment_status`, `paid_amount`, `paid_at`, `updated_at`

### Payment-related columns in DB but NOT updated on payment

| Column | Type | Notes |
|--------|------|--------|
| **payment_method_code** | varchar | Not set when recording payment |
| **paid_by** | varchar | Not set when recording payment |
| **payment_notes** | text | Not set when recording payment |
| **payment_type_code** | varchar | Not set when recording payment |
| **payment_terms** | varchar | Set at order level |
| **payment_due_date** | date | Set at order level |

**Recommendation:** If the latest payment method and “paid by” should be reflected on the order, add `payment_method_code` and `paid_by` to `updateOrderPaymentStatus()` (and optionally `payment_type_code`). Leave `payment_notes`, `payment_terms`, and `payment_due_date` as order-level unless you have a requirement to overwrite them on payment.

---

## Summary

| Table | Main gaps |
|-------|-----------|
| **org_payments_dtl_tr** | `check_number`, `check_bank`, `check_date` (and optionally amount breakdown + promo/gift FKs and `payment_channel`) not in insert. |
| **org_invoice_mst** | No critical gaps; only paid amount, status, and payment method are updated by design. |
| **org_orders_mst** | `payment_method_code`, `paid_by` (and optionally `payment_type_code`) not updated when recording payment. |
