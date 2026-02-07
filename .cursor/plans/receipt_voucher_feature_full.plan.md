---
name: Receipt Voucher Feature (Full)
overview: Full-feature receipt voucher implementation with org_fin_vouchers_mst, voucher_category + voucher_subtype, org_rcpt_receipts_mst.voucher_id (voucher 0..N receipts), allowed payment methods per type, cash direction and invoice impact rules, and enforcement by category. Coherent, integrated, complete, ready for implementation.
todos: []
isProject: false
---

# Receipt Voucher Feature Plan (Full — CleanMateX)

## Overview

Implement the **receipt voucher** feature using the **Enhanced (full-feature)** design: **org_fin_vouchers_mst** as parent of payment rows, **voucher_id** on org_payments_dtl_tr, **voucher_category + voucher_subtype** (scalable), audit log, truth rules, sequential numbering, void, templates, and **org_rcpt_receipts_mst.voucher_id** (voucher 0..N receipts for print/delivery). The plan is **coherent, integrated, complete, and ready for full-feature implementation** (not MVP-only).

---

## 1. Core relational model

- **Order** → 0..N **Invoices** → 0..N **Vouchers** (org_fin_vouchers_mst).
- **Voucher** → 1..N **payment rows** (org_payments_dtl_tr.voucher_id) when cash moves; **0 payment rows** for NON_CASH (credit note, write-off, adjustment).
- **Voucher** → 0..N **receipt/delivery records** (org_rcpt_receipts_mst.voucher_id) for print, email, WhatsApp.
- **Voucher** → 0..N **audit rows** (org_fin_voucher_audit_log).

**Cardinalities**

| From                 | To                        | Cardinality                           |
| -------------------- | ------------------------- | ------------------------------------- |
| org_orders_mst       | org_invoice_mst           | 1 —— 0..N                             |
| org_invoice_mst      | org_fin_vouchers_mst      | 1 —— 0..N                             |
| org_fin_vouchers_mst | org_payments_dtl_tr       | 1 —— 0..N (1..N for CASH_IN/CASH_OUT) |
| org_fin_vouchers_mst | org_rcpt_receipts_mst     | 1 —— **0..N**                         |
| org_fin_vouchers_mst | org_fin_voucher_audit_log | 1 —— 0..N                             |

**org_rcpt_receipts_mst.voucher_id**

- Add **voucher_id (UUID NULL)** to org_rcpt_receipts_mst with FK to org_fin_vouchers_mst.(id, tenant_org_id).
- A **voucher** may have **zero to many** org_rcpt_receipts_mst records (each print or email/WhatsApp send creates a receipt record linked to the voucher).
- Keep existing order_id on receipts for **order receipts**; voucher_id for **voucher receipts** (payment proof, refund proof, etc.).

---

## 2. Voucher classification: category + subtype (recommended scalable model)

**voucher_type** = classification of the **financial event** (business meaning). For long-term scalability use **voucher_category + voucher_subtype** instead of a single large enum.

### 2.1 Recommended fields on org_fin_vouchers_mst

| Field                | Type | Purpose                                                                                                                                                                         |
| -------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **voucher_category** | enum | **Stable, small set**: CASH_IN (money received), CASH_OUT (money paid out), NON_CASH (balance/value adjusted without cash). Drives enforcement (payment lines required or not). |
| **voucher_subtype**  | text | **Flexible, extensible**: SALE_PAYMENT, ADVANCE, DEPOSIT, REFUND, CREDIT_NOTE, WALLET_COMP, WRITE_OFF, PRICE_CORRECTION, PENALTY_FEE, etc. Feature-flag-driven per tenant.      |
| **reason_code**      | text | Optional but powerful: QUALITY_ISSUE, LOST_ITEM, LATE_PICKUP, PROMO_ADJUSTMENT, MANUAL_CORRECTION. Required for CREDIT/WRITE_OFF/ADJUSTMENT per rule matrix.                    |

**Backward compatibility:** Keep **voucher_type** (RECEIPT, PAYMENT, CREDIT, ADJUSTMENT, ADVANCE, DEPOSIT, PENALTY, WRITE_OFF) for display/reporting if desired; derive from category+subtype or store both during migration.

### 2.2 Mapping: voucher_type → voucher_category + voucher_subtype

| voucher_type | voucher_category | voucher_subtype                              |
| ------------ | ---------------- | -------------------------------------------- |
| RECEIPT      | CASH_IN          | SALE_PAYMENT                                 |
| PAYMENT      | CASH_OUT         | REFUND                                       |
| CREDIT       | NON_CASH         | CREDIT_NOTE (or WALLET_COMP if wallet-based) |
| ADJUSTMENT   | NON_CASH         | PRICE_CORRECTION                             |
| ADVANCE      | CASH_IN          | ADVANCE                                      |
| DEPOSIT      | CASH_IN          | DEPOSIT                                      |
| PENALTY      | CASH_IN          | PENALTY_FEE                                  |
| WRITE_OFF    | NON_CASH         | WRITE_OFF                                    |
| TRANSFER     | (special)        | INTERNAL_TRANSFER                            |
| COMMISSION   | (special)        | COMMISSION                                   |

### 2.3 Enforcement rules using category

- **voucher_category = CASH_IN or CASH_OUT**: Require **1..N payment lines**; enforce SUM(payment_lines.paid_amount) = voucher.total_amount.
- **voucher_category = NON_CASH**: Require **0 payment lines**; require **invoice_id + reason_code** (or approval/meta) for most subtypes (credit note, write-off, adjustment).

**Operational rule of thumb**

1. If **cash moves**: store it as voucher + payment lines (CASH_IN or CASH_OUT).
2. If **cash does not move** but customer balance changes: store it as voucher with **no payment lines** (NON_CASH) and accounting impact (credit note, write-off, adjustment).

---

## 3. Voucher types (full set) — business meaning

| Type           | Meaning                                     | Use cases                                                            | Cash direction | Payment lines?                        | Invoice impact               |
| -------------- | ------------------------------------------- | -------------------------------------------------------------------- | -------------- | ------------------------------------- | ---------------------------- |
| **RECEIPT**    | Money received by laundry                   | Pay at counter, online, delivery, advance                            | IN             | Yes (1..N)                            | paid_amount (+)              |
| **PAYMENT**    | Money paid out (refunds)                    | Refund dispute, overpayment, cancellation                            | OUT            | Yes (1..N)                            | paid_amount (−)              |
| **CREDIT**     | Non-cash value (credit note / store credit) | Compensate without refunding cash                                    | NONE           | Usually 0 (or WALLET if store credit) | total_due (−) or wallet      |
| **ADJUSTMENT** | Internal correction                         | Price correction, manual fix                                         | NONE           | No (0)                                | Depends on policy            |
| **ADVANCE**    | Deposit toward invoice                      | Customer pays before service fully priced; later consumed by invoice | IN             | Yes (1..N)                            | paid_amount (+) when applied |
| **DEPOSIT**    | Refundable deposit                          | Bags, uniforms, reusable items; later refunded or forfeited          | IN / OUT later | Yes (1..N)                            | No (keep off invoice)        |
| **PENALTY**    | Fee (late pickup, lost item, no-show)       | Late pickup fee, lost item charge                                    | IN             | Yes (1..N)                            | paid_amount (+) or fee line  |
| **WRITE_OFF**  | Finance cleanup                             | Small irrecoverable balance, customer never returned                 | NONE           | No (0)                                | total_due (−)                |
| **TRANSFER**   | (Tier-3) Money between branches             | Franchise internal settlements                                       | (special)      | Yes                                   | N/A                          |
| **COMMISSION** | (Tier-3) Marketplace                        | Platform ↔ tenant                                                    | (special)      | Yes                                   | N/A                          |

**Tier-3 (TRANSFER, COMMISSION):** Usually not needed for SaaS laundries; add only if multi-branch cash management or marketplace is in scope.

---

## 4. Allowed payment methods per voucher type

| voucher_type   | Allowed payment_method                                                |
| -------------- | --------------------------------------------------------------------- |
| **RECEIPT**    | CASH, CARD, ONLINE, WALLET, BANK_TRANSFER                             |
| **PAYMENT**    | CASH, ONLINE, BANK_TRANSFER (CARD refunds = ONLINE with provider_ref) |
| **CREDIT**     | None (0 lines) OR WALLET (if store credit = wallet top-up)            |
| **ADJUSTMENT** | None (0 lines)                                                        |
| **ADVANCE**    | CASH, CARD, ONLINE, WALLET, BANK_TRANSFER                             |
| **DEPOSIT**    | CASH, CARD, ONLINE, BANK_TRANSFER                                     |
| **PENALTY**    | CASH, CARD, ONLINE                                                    |
| **WRITE_OFF**  | None (0 lines)                                                        |

Enforce in application (or DB trigger): when inserting org_payments_dtl_tr, payment_method_code must be in the allowed set for the voucher’s voucher_type (or voucher_subtype).

---

## 5. Voucher type → cash direction + invoice impact (rule matrix)

| voucher_type   | Cash direction | Payment lines? | Invoice total_due changes? | Invoice paid_amount changes? | Typical link requirement                                                   |
| -------------- | -------------- | -------------- | -------------------------- | ---------------------------- | -------------------------------------------------------------------------- |
| **RECEIPT**    | IN             | Yes (1..N)     | No                         | Yes (+)                      | invoice_id recommended; order_id optional                                  |
| **PAYMENT**    | OUT            | Yes (1..N)     | No                         | Yes (−)                      | Must reference invoice_id (or original receipt via reversed_by_voucher_id) |
| **CREDIT**     | NONE           | Usually 0      | Yes (−) if credit note     | No (or optional)             | invoice_id + reason_code                                                   |
| **ADJUSTMENT** | NONE           | No (0)         | Depends                    | Depends                      | invoice_id or order_id + approval/meta                                     |
| **ADVANCE**    | IN             | Yes (1..N)     | No                         | Yes (+) when applied         | order_id or customer_id; later allocated to invoice                        |
| **DEPOSIT**    | IN/OUT later   | Yes (1..N)     | No                         | No (keep off invoice)        | customer_id; optionally order_id                                           |
| **PENALTY**    | IN             | Yes (1..N)     | No (or Yes if fee line)    | Yes (+)                      | invoice_id or order_id                                                     |
| **WRITE_OFF**  | NONE           | No (0)         | Yes (−)                    | No                           | invoice_id + approval                                                      |

---

## 6. Rule matrix (allowed links + required fields)

| voucher_type | invoice_id                         | order_id | customer_id | Required / optional                               | Notes                                         |
| ------------ | ---------------------------------- | -------- | ----------- | ------------------------------------------------- | --------------------------------------------- |
| RECEIPT      | Optional or required by policy     | Optional | Optional    | At least one of invoice_id, order_id, customer_id | Advance may have order_id or customer_id only |
| PAYMENT      | Required (or original receipt ref) | Optional | Optional    | Must reference original receipt/invoice           | reversed_by_voucher_id or metadata            |
| CREDIT       | Required                           | Optional | Optional    | invoice_id + reason_code                          | Credit note / store credit                    |
| ADJUSTMENT   | Optional                           | Optional | Optional    | invoice_id or order_id + approval/meta            | Internal only                                 |
| ADVANCE      | Optional (later)                   | Optional | Optional    | order_id or customer_id                           | Later allocated to invoice                    |
| DEPOSIT      | No                                 | Optional | Required    | customer_id                                       | Refundable; keep off invoice                  |
| PENALTY      | Optional                           | Optional | Optional    | invoice_id or order_id                            | Fee                                           |
| WRITE_OFF    | Required                           | Optional | Optional    | invoice_id + approval                             | Closes invoice                                |

---

## 7. Data model (migrations)

### 7.1 org_fin_vouchers_mst

- id, tenant_org_id, branch_id (optional), voucher_no (UNIQUE(tenant_org_id, voucher_no)), **voucher_category** (CASH_IN, CASH_OUT, NON_CASH), **voucher_subtype** (text), **voucher_type** (optional, for backward compat: RECEIPT, PAYMENT, CREDIT, ADJUSTMENT, ADVANCE, DEPOSIT, PENALTY, WRITE_OFF), invoice_id, order_id, customer_id, total_amount, currency_code, status (draft, issued, voided), issued_at, voided_at, void_reason, **reason_code**, reversed_by_voucher_id (optional, for refunds), content_html, content_text, metadata, audit fields.
- Composite FKs: (order_id, tenant_org_id), (invoice_id, tenant_org_id), (customer_id, tenant_org_id).
- CHECK (total_amount > 0); CHECK (voucher_category IN ('CASH_IN','CASH_OUT','NON_CASH')); UNIQUE (tenant_org_id, voucher_no).

### 7.2 org_payments_dtl_tr

- Add **voucher_id** (FK to org_fin_vouchers_mst). Keep invoice_id, order_id, customer_id as denormalized.
- Trigger: for vouchers with category CASH_IN/CASH_OUT, SUM(paid_amount) = voucher.total_amount; for NON_CASH, 0 payment rows.

### 7.3 org_fin_voucher_audit_log

- id, voucher_id, tenant_org_id, action (issued, voided, reversed, edited, approved), snapshot/reason, changed_at, changed_by. FK to org_fin_vouchers_mst.

### 7.4 org_rcpt_receipts_mst

- Add **voucher_id (UUID NULL)** with FK (voucher_id, tenant_org_id) → org_fin_vouchers_mst.(id, tenant_org_id).
- **org_fin_vouchers_mst 1 —— 0..N org_rcpt_receipts_mst**: a voucher may have zero to many receipt/delivery records (print, email, WhatsApp).
- Keep order_id for order-level receipts; voucher_id for voucher-level receipts.

---

## 8. Truth rules

- **Invoice total_due**: Canonical “what is owed”; reduced by CREDIT (credit note), WRITE_OFF, ADJUSTMENT per policy.
- **Invoice paid_amount**: SUM(vouchers voucher_category=CASH_IN, status=ISSUED) − SUM(vouchers voucher_category=CASH_OUT, status=ISSUED); ADVANCE applied when allocated to invoice.
- **Voucher total = SUM(payment rows)** for CASH_IN/CASH_OUT; **0 payment rows** for NON_CASH (CREDIT, ADJUSTMENT, WRITE_OFF).
- **payment_status**: UNPAID | PARTIALLY_PAID | PAID | OVERPAID (computed from vouchers).

---

## 9. Implementation summary (full feature)

- **Phase 1 (Enhanced):** org_fin_vouchers_mst, org_fin_voucher_audit_log, voucher_id on org_payments_dtl_tr, **voucher_id on org_rcpt_receipts_mst**, voucher_category + voucher_subtype (+ voucher_type if desired), reason_code, backfill, voucher service (createVoucher, attachPaymentRows, issueVoucher, voidVoucher, getVoucherData), processPayment creates voucher then payment rows, print (billing-receipt-voucher-print-rprt), report (billing-receipt-vouchers-rprt), templates, void, RLS.
- **Phase 2 (Advanced):** Multi-channel delivery (email/WhatsApp) via org_rcpt_receipts_mst linked to voucher_id, batch/daily voucher, cash-up link, accounting export, feature flags for subtypes (e.g. DEPOSIT only for tenants who use it).
- **Subtypes:** Feature-flag-driven (e.g. ADVANCE, DEPOSIT, PENALTY, WRITE_OFF enabled per tenant/plan).

---

## 10. Plan coherence and readiness

- **Coherent:** Single finance spine (Order → Invoice → Voucher → payment rows); voucher_type/category/subtype define business meaning; payment_method defines how cash moved; org_rcpt_receipts_mst.voucher_id links delivery to voucher.
- **Integrated:** Allowed payment methods per type, cash direction and invoice impact tables, rule matrix, and enforcement by category are aligned; migration path and backfill specified.
- **Complete:** Core + extended voucher types (RECEIPT, PAYMENT, CREDIT, ADJUSTMENT, ADVANCE, DEPOSIT, PENALTY, WRITE_OFF; optional TRANSFER, COMMISSION); category+subtype for scalability; voucher ↔ receipts 0..N.
- **Best practice:** Category (CASH_IN/CASH_OUT/NON_CASH) for stable logic; subtype for extensibility without DB enum churn; reason_code and approval for audit; tenant isolation and RLS throughout.
- **Full feature, not MVP:** Implements full voucher lifecycle, void, audit log, sequential voucher_no, templates, print, report, and optional delivery; supports partial payments, refunds, credit notes, advances, deposits, penalties, write-offs.
- **Ready to use:** Plan can be implemented as-is; subtypes and optional types (ADVANCE, DEPOSIT, PENALTY, WRITE_OFF) can be gated by feature flags for gradual rollout.
